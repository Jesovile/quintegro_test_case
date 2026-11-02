import { Contact, OrderDTO, OrderRecord, OrderStatus } from '../types/entities';
import { IOrderRepository, OrderTransitionPatch } from '../repositories/interfaces';
import { IGeoService, IntegrationUnavailableError, UsAddress, withTimeout } from '../integrations/interfaces';
import { DomainError } from '../errors/domainError';
import { OrderService } from './orderService';
import { PromoService } from './promoService';
import { PaymentSettlement } from './paymentService';
import { canTransition } from './orderStateMachine';
import { DeliveryInput, normalizeDelivery, validateDelivery } from './checkoutValidation';

export interface Delivery extends Contact {
  address: UsAddress;
}

const GEO_TIMEOUT_MS = 5000;

// Fixed texts: the reason from the Geo service may echo the entered address
const ADDRESS_REJECTED_MESSAGES: Record<keyof UsAddress, string> = {
  line1: 'We could not verify this street address',
  line2: 'We could not verify this apartment or suite',
  city: 'We could not verify this city',
  state: 'We could not verify this state',
  zip: 'We could not verify this ZIP code'
};

const sameAddress = (a: UsAddress, b: UsAddress): boolean =>
  a.line1 === b.line1 && (a.line2 ?? '') === (b.line2 ?? '') && a.city === b.city && a.state === b.state && a.zip === b.zip;

const hasPaymentInProgress = (order: OrderRecord): boolean => Boolean(order.payment && !order.payment.paymentId);

const sameContact = (a: Contact, b: Contact): boolean =>
  a.fullName === b.fullName && a.email === b.email && a.phone === b.phone;

export class CheckoutService {
  constructor(
    private orderRepository: IOrderRepository,
    private orderService: OrderService,
    private geoService: IGeoService,
    private promoService: PromoService,
    private payments: PaymentSettlement,
    private geoTimeoutMs = GEO_TIMEOUT_MS
  ) {}

  async applyPromo(orderId: string, userId: string, code: string): Promise<OrderDTO> {
    await this.settleBeforeChange(orderId, userId);
    const order = this.findOwnOrder(orderId, userId);
    this.assertInCheckout(order);

    const promo = this.promoService.getActivePromo(code);
    if (order.promo?.id === promo.id && order.promo.dueDate === promo.dueDate) {
      return this.orderService.toDTO(order);
    }

    // A copy: later changes to the promo catalog must not alter an order that already has it
    return this.updateInCheckout(orderId, { promo: { ...promo } });
  }

  async removePromo(orderId: string, userId: string): Promise<OrderDTO> {
    await this.settleBeforeChange(orderId, userId);
    const order = this.findOwnOrder(orderId, userId);
    this.assertInCheckout(order);

    if (!order.promo) {
      return this.orderService.toDTO(order);
    }
    return this.updateInCheckout(orderId, { promo: undefined });
  }

  async startCheckout(orderId: string, userId: string): Promise<OrderDTO> {
    const order = this.findOwnOrder(orderId, userId);

    if (order.status === 'checkout') {
      return this.orderService.toDTO(order);
    }
    if (order.status === 'created' && order.products.length === 0) {
      throw new DomainError('ORDER_EMPTY', 'The order is empty');
    }

    return this.moveTo(order, 'checkout');
  }

  async exitCheckout(orderId: string, userId: string): Promise<OrderDTO> {
    await this.settleBeforeChange(orderId, userId);
    const order = this.findOwnOrder(orderId, userId);

    if (order.status === 'created') {
      return this.orderService.toDTO(order);
    }

    this.assertNoPaymentInProgress(order);
    return this.moveTo(order, 'created');
  }

  async saveDelivery(orderId: string, userId: string, input: DeliveryInput): Promise<OrderDTO> {
    await this.settleBeforeChange(orderId, userId);
    const order = this.findOwnOrder(orderId, userId);
    this.assertInCheckout(order);

    const delivery = normalizeDelivery(input);
    const fieldErrors = validateDelivery(delivery);
    if (fieldErrors.length > 0) {
      throw new DomainError('VALIDATION_FAILED', 'Some fields are invalid', fieldErrors);
    }

    const { fullName, email, phone, address } = delivery;
    const contact = { fullName, email, phone };

    // A repeated save with the same data (double click, retry) changes nothing
    if (await this.isAlreadySaved(order, contact, address)) {
      return this.orderService.toDTO(order);
    }

    const result = await this.callGeo(orderId, () => this.geoService.validateAddress(address));
    if (!result.ok) {
      const message = ADDRESS_REJECTED_MESSAGES[result.field];
      throw new DomainError('ADDRESS_REJECTED', message, [{ field: `address.${result.field}`, message }]);
    }

    // A payment may have started while the address was being checked
    const latest = this.orderRepository.findById(orderId);
    if (latest && hasPaymentInProgress(latest)) {
      await this.forgetAddress(orderId, result.addressRef);
      throw new DomainError('PAYMENT_IN_PROGRESS', 'A payment is in progress. Please wait for it to finish.');
    }

    // The order may have left checkout while the address was being checked
    const updated = this.orderRepository.transition(orderId, ['checkout'], { contact, addressRef: result.addressRef });
    if (!updated) {
      await this.forgetAddress(orderId, result.addressRef);
      throw new DomainError('ORDER_NOT_EDITABLE', 'This order can no longer be changed');
    }

    if (order.addressRef) {
      await this.forgetAddress(orderId, order.addressRef);
    }
    return this.orderService.toDTO(updated);
  }

  // Called for an order already returned to its owner
  async getDelivery(orderId: string): Promise<Delivery | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order?.contact || !order.addressRef) {
      return null;
    }

    const addressRef = order.addressRef;
    const address = await this.callGeo(orderId, () => this.geoService.getAddress(addressRef));
    if (!address) {
      throw new DomainError('ADDRESS_NOT_FOUND', 'The saved address is no longer available. Please enter it again.');
    }
    return { ...order.contact, address };
  }

  private async isAlreadySaved(order: OrderRecord, contact: Contact, address: UsAddress): Promise<boolean> {
    if (!order.contact || !order.addressRef || !sameContact(order.contact, contact)) {
      return false;
    }
    const addressRef = order.addressRef;
    try {
      const saved = await withTimeout(this.geoService.getAddress(addressRef), this.geoTimeoutMs, 'Geo service');
      return saved !== null && sameAddress(saved, address);
    } catch {
      // Unknown state: validate the address again
      return false;
    }
  }

  // Best effort: an address left behind is removed on the Geo side, a failure must not fail the save
  private async forgetAddress(orderId: string, addressRef: string): Promise<void> {
    try {
      await withTimeout(this.geoService.deleteAddress(addressRef), this.geoTimeoutMs, 'Geo service');
    } catch {
      console.warn('Geo address cleanup failed', { orderId });
    }
  }

  private findOwnOrder(orderId: string, userId: string): OrderRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new DomainError('ORDER_NOT_FOUND', 'Order not found or access denied');
    }
    return order;
  }

  // An order with a payment attempt in progress is frozen; the attempt is resolved with the bank first.
  // Callers read the order again afterwards: a parallel request may have changed it during the await.
  private async settleBeforeChange(orderId: string, userId: string): Promise<void> {
    const order = this.findOwnOrder(orderId, userId);
    if (hasPaymentInProgress(order) && (await this.payments.settlePendingPayment(orderId)) === 'paid') {
      throw new DomainError('ORDER_NOT_EDITABLE', 'This order has already been paid');
    }
  }

  // Synchronous check right before a write: a payment attempt started by another request wins
  private assertNoPaymentInProgress(order: OrderRecord): void {
    const latest = this.orderRepository.findById(order.orderId);
    if (latest && hasPaymentInProgress(latest)) {
      throw new DomainError('PAYMENT_IN_PROGRESS', 'A payment is in progress. Please wait for it to finish.');
    }
  }

  private updateInCheckout(orderId: string, patch: OrderTransitionPatch): OrderDTO {
    const latest = this.orderRepository.findById(orderId);
    if (latest) {
      this.assertNoPaymentInProgress(latest);
    }
    const updated = this.orderRepository.transition(orderId, ['checkout'], patch);
    if (!updated) {
      throw new DomainError('ORDER_NOT_EDITABLE', 'This order can no longer be changed');
    }
    return this.orderService.toDTO(updated);
  }

  private assertInCheckout(order: OrderRecord): void {
    if (order.status !== 'checkout') {
      throw new DomainError('ORDER_NOT_EDITABLE', 'This order can no longer be changed');
    }
  }

  // Outages and timeouts become GEO_UNAVAILABLE; any other error is a bug and is reported as INTERNAL
  private async callGeo<T>(orderId: string, call: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(call(), this.geoTimeoutMs, 'Geo service');
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        console.warn('Geo service unavailable', { orderId });
        throw new DomainError('GEO_UNAVAILABLE', 'The address service is unavailable. Please try again.');
      }
      throw error;
    }
  }

  private moveTo(order: OrderRecord, to: OrderStatus): OrderDTO {
    const updated = canTransition(order.status, to)
      ? this.orderRepository.transition(order.orderId, [order.status], { status: to })
      : null;

    if (!updated) {
      throw new DomainError('INVALID_STATUS_TRANSITION', `The order cannot move to ${to}`);
    }
    return this.orderService.toDTO(updated);
  }
}
