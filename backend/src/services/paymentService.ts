import { randomUUID } from 'crypto';
import { OrderDTO, OrderRecord, PaymentRecord } from '../types/entities';
import { IOrderRepository } from '../repositories/interfaces';
import { IBankGateway, IGeoService, IntegrationUnavailableError, PaymentLookup, withTimeout } from '../integrations/interfaces';
import { DomainError } from '../errors/domainError';
import { OrderService } from './orderService';

export interface PayOrderInput {
  cardToken: string;
  expectedTotal: number;
}

// What other services need before they change an order in checkout
export interface PaymentSettlement {
  // Resolves an attempt in progress with the bank: 'paid' if the money was taken, 'clear' if the order may be changed
  settlePendingPayment(orderId: string): Promise<'paid' | 'clear'>;
}

const DEFAULT_TIMEOUTS = { geoMs: 5000, bankMs: 5000 };

const PAID_STATUSES: OrderRecord['status'][] = ['paid', 'processing', 'deliver'];

const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

const pendingAttempt = (order: OrderRecord | undefined): PaymentRecord | undefined =>
  order?.payment && !order.payment.paymentId ? order.payment : undefined;

export class PaymentService implements PaymentSettlement {
  constructor(
    private orderRepository: IOrderRepository,
    private orderService: OrderService,
    private geoService: IGeoService,
    private bankGateway: IBankGateway,
    private timeouts: { geoMs: number; bankMs: number } = DEFAULT_TIMEOUTS
  ) {}

  async payOrder(orderId: string, userId: string, { cardToken, expectedTotal }: PayOrderInput): Promise<OrderDTO> {
    if (!CARD_TOKEN_PATTERN.test(cardToken)) {
      throw new DomainError('VALIDATION_FAILED', 'The card could not be read', [{ field: 'cardToken', message: 'Invalid card token' }]);
    }

    let order = this.findOwnOrder(orderId, userId);

    // A repeated request (double click, second tab, retry) for a paid order returns the order, no new charge
    if (PAID_STATUSES.includes(order.status)) {
      return this.orderService.toDTO(order);
    }
    if (order.status !== 'checkout') {
      throw new DomainError('INVALID_STATUS_TRANSITION', 'This order cannot be paid');
    }

    // A previous attempt (lost answer, other tab) is resolved with the bank first
    const attempt = pendingAttempt(order);
    if (attempt) {
      const lookup = await this.lookup(orderId, attempt.idempotencyKey);
      if (lookup.status === 'approved' && !lookup.refunded && lookup.amountUsd === attempt.amountUsd) {
        return this.completePayment(orderId, userId, attempt, lookup.paymentId);
      }
      if (lookup.status !== 'unknown') {
        // Declined or refunded: that attempt is over, the next one needs a new key
        this.clearAttempt(orderId, attempt.idempotencyKey);
      }
      order = this.findOwnOrder(orderId, userId);
    }

    if (!order.contact || !order.addressRef) {
      throw new DomainError('DELIVERY_REQUIRED', 'Enter delivery details before paying');
    }

    // The amount is always computed here; the client value only proves the user saw the same total
    const { total } = this.orderService.toDTO(order).totals;
    if (total !== expectedTotal) {
      throw new DomainError('TOTAL_CHANGED', 'The order total has changed. Please review it and confirm again.');
    }

    await this.assertAddressExists(orderId, order.addressRef);

    const current = this.reserveAttempt(orderId, total);

    const result = await this.callBank(
      orderId,
      () => this.bankGateway.charge({ cardToken, amountUsd: current.amountUsd, idempotencyKey: current.idempotencyKey }),
      'PAYMENT_UNCONFIRMED'
    );
    if (result.status === 'declined') {
      // A new attempt, e.g. with another card, must be a new charge at the bank
      this.clearAttempt(orderId, current.idempotencyKey);
      throw new DomainError('PAYMENT_DECLINED', 'Your card was declined. Please use another card.');
    }

    return this.completePayment(orderId, userId, current, result.paymentId);
  }

  async settlePendingPayment(orderId: string): Promise<'paid' | 'clear'> {
    const attempt = pendingAttempt(this.orderRepository.findById(orderId));
    if (!attempt) {
      return 'clear';
    }

    const lookup = await this.lookup(orderId, attempt.idempotencyKey);

    // Read again after the await: another request may have finished the attempt meanwhile
    const order = this.orderRepository.findById(orderId);
    if (!order || PAID_STATUSES.includes(order.status)) {
      return 'paid';
    }
    if (pendingAttempt(order)?.idempotencyKey !== attempt.idempotencyKey) {
      return 'clear';
    }

    if (lookup.status === 'approved' && !lookup.refunded) {
      if (lookup.amountUsd === attempt.amountUsd && order.status === 'checkout') {
        this.orderRepository.transition(orderId, ['checkout'], { status: 'paid', payment: { ...attempt, paymentId: lookup.paymentId } });
        return 'paid';
      }
      // Money taken for an amount the order no longer has: give it back before the change
      this.clearAttempt(orderId, attempt.idempotencyKey);
      await this.refundCharge(orderId, lookup.paymentId, lookup.amountUsd);
      return 'clear';
    }

    // Declined, refunded or never received: the attempt is dropped. A charge that still lands is refunded by completePayment.
    this.clearAttempt(orderId, attempt.idempotencyKey);
    return 'clear';
  }

  // Creates the attempt in the same synchronous step as the read, so parallel requests share one key
  private reserveAttempt(orderId: string, amountUsd: number): PaymentRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.status !== 'checkout') {
      throw new DomainError('INVALID_STATUS_TRANSITION', 'This order cannot be paid');
    }

    const existing = pendingAttempt(order);
    if (existing && existing.amountUsd === amountUsd) {
      return existing;
    }

    // An unanswered attempt for another amount was never received by the bank; a stray charge is refunded on arrival
    const attempt: PaymentRecord = { idempotencyKey: `order_${orderId}_${randomUUID()}`, amountUsd };
    this.orderRepository.transition(orderId, ['checkout'], { payment: attempt });
    return attempt;
  }

  private clearAttempt(orderId: string, idempotencyKey: string): void {
    const order = this.orderRepository.findById(orderId);
    if (pendingAttempt(order)?.idempotencyKey === idempotencyKey && order) {
      this.orderRepository.transition(orderId, [order.status], { payment: undefined });
    }
  }

  private async completePayment(orderId: string, userId: string, attempt: PaymentRecord, paymentId: string): Promise<OrderDTO> {
    // Read and update in one synchronous step: only the current attempt may mark the order paid
    const order = this.findOwnOrder(orderId, userId);
    if (order.status === 'checkout' && pendingAttempt(order)?.idempotencyKey === attempt.idempotencyKey) {
      const updated = this.orderRepository.transition(orderId, ['checkout'], { status: 'paid', payment: { ...attempt, paymentId } });
      if (updated) {
        return this.orderService.toDTO(updated);
      }
    }

    // Another request for the same charge got here first
    if (order.payment?.paymentId === paymentId) {
      return this.orderService.toDTO(order);
    }

    // The attempt was dropped (order changed, cancelled or reopened) while the bank was charging: give the money back
    const refunded = await this.refundCharge(orderId, paymentId, attempt.amountUsd);
    if (!refunded) {
      throw new DomainError('REFUND_FAILED', 'The order changed during payment and the refund could not be completed yet. We will retry it.');
    }
    throw new DomainError('PAYMENT_REFUNDED', 'The order changed during payment. The charge has been refunded.');
  }

  // Returns false when the bank did not confirm the refund; the charge is then kept on the order for a retry
  private async refundCharge(orderId: string, paymentId: string, amountUsd: number): Promise<boolean> {
    try {
      const refund = await withTimeout(
        this.bankGateway.refund({ paymentId, amountUsd, idempotencyKey: `refund_${paymentId}` }),
        this.timeouts.bankMs,
        'Bank'
      );
      if (refund.status === 'refunded') {
        console.warn('Charge refunded', { orderId, paymentId });
        return true;
      }
    } catch (error) {
      if (!(error instanceof IntegrationUnavailableError)) {
        throw error;
      }
    }

    console.error('Refund failed, kept for retry', { orderId, paymentId });
    const order = this.orderRepository.findById(orderId);
    if (order) {
      this.orderRepository.transition(orderId, [order.status], {
        refundsPending: [...(order.refundsPending ?? []), { paymentId, amountUsd }]
      });
    }
    return false;
  }

  private async lookup(orderId: string, idempotencyKey: string): Promise<PaymentLookup> {
    return this.callBank(orderId, () => this.bankGateway.getPaymentByKey(idempotencyKey), 'PAYMENT_UNAVAILABLE');
  }

  private async assertAddressExists(orderId: string, addressRef: string): Promise<void> {
    try {
      const address = await withTimeout(this.geoService.getAddress(addressRef), this.timeouts.geoMs, 'Geo service');
      if (!address) {
        throw new DomainError('ADDRESS_NOT_FOUND', 'The saved address is no longer available. Please enter it again.');
      }
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        console.warn('Geo service unavailable', { orderId });
        throw new DomainError('GEO_UNAVAILABLE', 'The address service is unavailable. Please try again.');
      }
      throw error;
    }
  }

  // An outage before the charge is PAYMENT_UNAVAILABLE; a lost answer to a charge is PAYMENT_UNCONFIRMED
  private async callBank<T>(orderId: string, call: () => Promise<T>, unavailableCode: 'PAYMENT_UNAVAILABLE' | 'PAYMENT_UNCONFIRMED'): Promise<T> {
    try {
      return await withTimeout(call(), this.timeouts.bankMs, 'Bank');
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        console.warn('Bank unavailable', { orderId, code: unavailableCode });
        throw unavailableCode === 'PAYMENT_UNCONFIRMED'
          ? new DomainError('PAYMENT_UNCONFIRMED', 'We could not confirm the payment. Check again before using another card.')
          : new DomainError('PAYMENT_UNAVAILABLE', 'The payment service is unavailable. Please try again.');
      }
      throw error;
    }
  }

  private findOwnOrder(orderId: string, userId: string): OrderRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new DomainError('ORDER_NOT_FOUND', 'Order not found or access denied');
    }
    return order;
  }
}
