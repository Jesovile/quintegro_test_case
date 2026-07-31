import { createHash, randomUUID } from 'crypto';
import { ICheckoutStore, IOrderRepository, IProductRepository, IPromoRepository } from '../repositories/interfaces';
import { CheckoutError } from './errors';
import { DeliveryGateway, PaymentGateway } from './ports';
import {
  CheckoutAttempt,
  CheckoutDeliverySnapshot,
  CheckoutQuote,
  CheckoutQuoteInput,
  CheckoutSnapshot,
  PaymentMethodInput,
  SubmitOrderInput,
  SubmitOrderPayload,
} from './types';

const CURRENCY = 'USD' as const;

export class CheckoutService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productRepository: IProductRepository,
    private readonly promoRepository: IPromoRepository,
    private readonly checkoutStore: ICheckoutStore,
    private readonly paymentGateway: PaymentGateway,
    private readonly deliveryGateway: DeliveryGateway,
  ) {}

  async createQuote(input: CheckoutQuoteInput, userId: string): Promise<CheckoutQuote> {
    const order = this.getEditableOrder(input.orderId, userId);
    this.validateCart(input, order.products);
    this.validateAddress(input.deliveryAddress);

    const subtotalMinor = order.products.reduce(
      (total, line) => total + Math.round(line.price * 100) * line.amount,
      0,
    );
    const discountMinor = this.discountFor(input.promoCode, subtotalMinor);
    const delivery = await this.deliveryGateway.quote({
      address: input.deliveryAddress,
      method: input.deliveryMethod,
      currency: CURRENCY,
    });
    const fingerprint = this.fingerprint({
      orderId: input.orderId,
      products: order.products.map(line => ({ productId: line.id, quantity: line.amount, priceMinor: Math.round(line.price * 100) })),
      promoCode: input.promoCode || null,
      deliveryAddress: input.deliveryAddress,
      deliveryMethod: input.deliveryMethod,
      deliveryQuoteId: delivery.id,
      deliveryFeeMinor: delivery.feeMinor,
    });
    const quote: CheckoutQuote = {
      id: `quote_${randomUUID()}`,
      fingerprint,
      subtotalMinor,
      discountMinor,
      deliveryFeeMinor: delivery.feeMinor,
      totalMinor: subtotalMinor - discountMinor + delivery.feeMinor,
      currency: CURRENCY,
      deliveryQuoteId: delivery.id,
      expiresAt: delivery.expiresAt,
      input: input,
    };
    this.checkoutStore.saveQuote(quote);
    return quote;
  }

  async submitOrder(input: SubmitOrderInput, userId: string): Promise<SubmitOrderPayload> {
    if (!input.attemptId || !input.quoteId || !input.quoteFingerprint || !Number.isInteger(input.expectedTotalMinor)) {
      throw new CheckoutError('INVALID_CHECKOUT_INPUT', 'Checkout input is invalid');
    }
    this.validatePaymentMethod(input.paymentMethod);
    const quote = this.checkoutStore.findQuote(input.quoteId);
    if (!quote || quote.id !== input.quoteId || quote.input.orderId !== input.orderId) {
      throw new CheckoutError('QUOTE_NOT_FOUND', 'Checkout quote was not found', 409);
    }
    if (quote.expiresAt <= Date.now()) throw new CheckoutError('QUOTE_EXPIRED', 'Checkout quote has expired', 409);
    if (quote.fingerprint !== input.quoteFingerprint || quote.totalMinor !== input.expectedTotalMinor) {
      throw new CheckoutError('QUOTE_CHANGED', 'Checkout total has changed', 409);
    }

    const attempt: CheckoutAttempt = {
      attemptId: input.attemptId,
      orderId: input.orderId,
      userId,
      quoteId: quote.id,
      fingerprint: quote.fingerprint,
      state: 'processing',
    };
    let claimed = this.checkoutStore.claimAttempt(attempt);
    if (claimed.attemptId !== input.attemptId) {
      throw new CheckoutError('CHECKOUT_IN_PROGRESS', 'Another checkout attempt is in progress', 409);
    }
    if (claimed.userId !== userId || claimed.quoteId !== quote.id || claimed.fingerprint !== quote.fingerprint) {
      throw new CheckoutError('ATTEMPT_CONFLICT', 'Checkout attempt does not match this request', 409);
    }
    if (claimed.state === 'completed' && claimed.result) return claimed.result;
    if (claimed.state === 'action_required' || claimed.state === 'compensation_required') return this.payload(claimed);
    if (claimed.state === 'payment_failed') {
      claimed = { ...claimed, state: 'processing', payment: undefined, delivery: undefined, errorCode: undefined };
      this.checkoutStore.updateAttempt(claimed);
    }

    try {
      this.revalidateQuote(quote, userId);
    } catch (error) {
      this.checkoutStore.abandonAttempt(input.orderId, input.attemptId);
      throw error;
    }

    if (!claimed.payment) {
      const authorization = await this.paymentGateway.authorize({
        amountMinor: quote.totalMinor,
        currency: CURRENCY,
        paymentMethodToken: input.paymentMethod.token,
        idempotencyKey: this.key(input.attemptId, 'authorize'),
      });
      if (authorization.status === 'unavailable') return this.saveAndReturn(claimed, 'processing', authorization.errorCode);
      if (authorization.status === 'declined') return this.saveAndReturn(claimed, 'payment_failed', authorization.errorCode);
      if (authorization.status === 'requires_action') return this.saveAndReturn(claimed, 'action_required', authorization.errorCode);
      if (!authorization.reference) throw new CheckoutError('PAYMENT_INVALID', 'Payment authorization is invalid', 502);
      claimed = {
        ...claimed,
        state: 'payment_authorized',
        payment: { status: 'authorized', reference: authorization.reference, brand: input.paymentMethod.brand, last4: input.paymentMethod.last4 },
      };
      this.checkoutStore.updateAttempt(claimed);
    }

    if (!claimed.delivery) {
      try {
        const scheduled = await this.deliveryGateway.schedule({
          quoteId: quote.deliveryQuoteId,
          address: quote.input.deliveryAddress,
          idempotencyKey: this.key(input.attemptId, 'schedule'),
        });
        const delivery: CheckoutDeliverySnapshot = {
          quoteId: quote.deliveryQuoteId,
          reference: scheduled.reference,
          method: quote.input.deliveryMethod,
          feeMinor: quote.deliveryFeeMinor,
          estimatedDeliveryAt: scheduled.estimatedDeliveryAt,
        };
        claimed = { ...claimed, state: 'delivery_scheduled', delivery };
        this.checkoutStore.updateAttempt(claimed);
      } catch {
        return this.compensateAuthorization(claimed, 'DELIVERY_UNAVAILABLE');
      }
    }

    const capture = await this.paymentGateway.capture({
      authorizationReference: claimed.payment.reference,
      amountMinor: quote.totalMinor,
      currency: CURRENCY,
      idempotencyKey: this.key(input.attemptId, 'capture'),
    });
    if (capture.status === 'unavailable') return this.compensateDelivery(claimed, capture.errorCode || 'CAPTURE_UNAVAILABLE');

    const completedPayment = { ...claimed.payment, status: 'captured' as const, reference: capture.reference || claimed.payment.reference };
    const snapshot: CheckoutSnapshot = {
      quote: this.quoteSnapshot(quote),
      payment: completedPayment,
      delivery: claimed.delivery,
      submittedAt: Date.now(),
    };
    const result: SubmitOrderPayload = {
      status: 'completed',
      orderId: input.orderId,
      checkout: snapshot,
      paymentReference: completedPayment.reference,
      deliveryReference: claimed.delivery.reference,
    };
    this.checkoutStore.complete(input.orderId, input.attemptId, snapshot, result);
    return result;
  }

  private getEditableOrder(orderId: string, userId: string) {
    const order = this.getCreatedOrder(orderId, userId);
    if (!this.checkoutStore.isCartEditable(orderId)) throw new CheckoutError('CHECKOUT_IN_PROGRESS', 'Checkout is in progress', 409);
    return order;
  }

  private getCreatedOrder(orderId: string, userId: string) {
    const order = this.orderRepository.findById(orderId);
    if (!order) throw new CheckoutError('ORDER_NOT_FOUND', 'Order was not found', 404);
    if (order.userId !== userId) throw new CheckoutError('ORDER_FORBIDDEN', 'Order access is denied', 403);
    if (order.status !== 'created') throw new CheckoutError('ORDER_NOT_EDITABLE', 'Order is not editable', 409);
    return order;
  }

  private revalidateQuote(quote: CheckoutQuote, userId: string): void {
    const order = this.getCreatedOrder(quote.input.orderId, userId);
    this.validateCart(quote.input, order.products);
    this.validateAddress(quote.input.deliveryAddress);
    const subtotalMinor = order.products.reduce((total, line) => total + Math.round(line.price * 100) * line.amount, 0);
    const discountMinor = this.discountFor(quote.input.promoCode, subtotalMinor);
    if (subtotalMinor !== quote.subtotalMinor || discountMinor !== quote.discountMinor) {
      throw new CheckoutError('QUOTE_CHANGED', 'Checkout total has changed', 409);
    }
  }

  private validateCart(input: CheckoutQuoteInput, orderLines: Array<{ id: string; amount: number; price: number }>): void {
    if (!Array.isArray(input.products) || !input.products.length || input.products.length !== orderLines.length) {
      throw new CheckoutError('INVALID_CART', 'Cart items do not match the order');
    }
    const requested = new Map<string, number>();
    for (const line of input.products) {
      if (!line.productId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10 || requested.has(line.productId)) {
        throw new CheckoutError('INVALID_CART', 'Cart contains invalid product quantities');
      }
      requested.set(line.productId, line.quantity);
    }
    for (const line of orderLines) {
      if (!this.productRepository.findById(line.id) || requested.get(line.id) !== line.amount) {
        throw new CheckoutError('INVALID_CART', 'Cart items do not match the order');
      }
    }
  }

  private validateAddress(address: CheckoutQuoteInput['deliveryAddress']): void {
    if (!address || Object.values(address).some(value => typeof value !== 'string' || !value.trim())) {
      throw new CheckoutError('INVALID_ADDRESS', 'Delivery address is incomplete');
    }
  }

  private validatePaymentMethod(paymentMethod: PaymentMethodInput): void {
    if (!paymentMethod || !paymentMethod.token || !paymentMethod.brand || !/^\d{4}$/.test(paymentMethod.last4)) {
      throw new CheckoutError('INVALID_PAYMENT_METHOD', 'Payment method is invalid');
    }
  }

  private discountFor(promoCode: string | undefined, subtotalMinor: number): number {
    if (!promoCode) return 0;
    const promo = this.promoRepository.findById(promoCode);
    if (!promo || promo.dueDate <= Date.now()) throw new CheckoutError('INVALID_PROMO', 'Promo code is invalid');
    return Math.round(subtotalMinor * promo.discount / 100);
  }

  private async compensateAuthorization(attempt: CheckoutAttempt, errorCode: string): Promise<SubmitOrderPayload> {
    try {
      await this.paymentGateway.void({ authorizationReference: attempt.payment!.reference, idempotencyKey: this.key(attempt.attemptId, 'void') });
      return this.saveAndReturn(attempt, 'payment_failed', errorCode);
    } catch {
      return this.saveAndReturn(attempt, 'compensation_required', 'VOID_FAILED');
    }
  }

  private async compensateDelivery(attempt: CheckoutAttempt, errorCode: string): Promise<SubmitOrderPayload> {
    try {
      await this.deliveryGateway.cancel({ deliveryReference: attempt.delivery!.reference, idempotencyKey: this.key(attempt.attemptId, 'cancel') });
      return this.compensateAuthorization(attempt, errorCode);
    } catch {
      return this.saveAndReturn(attempt, 'compensation_required', 'DELIVERY_CANCEL_FAILED');
    }
  }

  private saveAndReturn(attempt: CheckoutAttempt, state: CheckoutAttempt['state'], errorCode?: string): SubmitOrderPayload {
    const updated = { ...attempt, state, errorCode };
    this.checkoutStore.updateAttempt(updated);
    return this.payload(updated);
  }

  private payload(attempt: CheckoutAttempt): SubmitOrderPayload {
    return {
      status: attempt.state,
      orderId: attempt.orderId,
      paymentReference: attempt.payment?.reference,
      deliveryReference: attempt.delivery?.reference,
      errorCode: attempt.errorCode,
    };
  }

  private quoteSnapshot(quote: CheckoutQuote): Omit<CheckoutQuote, 'input'> {
    const { input: _input, ...snapshot } = quote;
    return snapshot;
  }

  private key(attemptId: string, operation: string): string {
    return `${attemptId}:${operation}`;
  }

  private fingerprint(value: object): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
