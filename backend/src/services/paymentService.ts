import { OrderDTO, PaymentRecord, PaymentSummaryDTO } from '../types/entities';
import { IPaymentRepository, IOrderRepository } from '../repositories/interfaces';
import { OrderService } from './orderService';
import { evaluateMockPayment } from './mockPaymentProvider';

// NOTE on constructor shape: tech-design.md §2.4 / implementation-plan-04.md's
// iteration 2.1 sketch PaymentService as constructed with just
// (paymentRepository, orderRepository), with calculateOrderTotal referenced
// as a bare function. In the actual merged codebase (Feature 3),
// calculateOrderTotal is an instance method on OrderService (not a standalone
// exported function), and building a full OrderDTO (product lookups, promo
// projection, total) requires OrderService's existing transformToDTO/
// getOrderById logic. Rather than duplicate that logic here or introduce a
// circular OrderService<->PaymentService dependency, PaymentService takes
// OrderService as a third constructor argument and reuses its
// calculateOrderTotal/getOrderById methods directly. orderRepository is still
// injected separately because PaymentService needs the raw OrderRecord
// (status, promo id, deliveryMethod fee, raw product line items) which
// OrderDTO does not expose in the shape calculateOrderTotal needs.

export interface CardInput {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholderName: string;
}

export interface PayResult {
  order: OrderDTO;
  payment: PaymentSummaryDTO;
}

// Server-side sanity validation on card fields — a minimal backstop, not full
// card validation. Its only purpose is to stop a direct GraphQL Playground
// call from feeding garbage straight into the mock provider / persisted
// PaymentRecord. See tech-design.md §4.4.
function validateCard(card: CardInput): void {
  const normalizedNumber = card.cardNumber.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(normalizedNumber)) {
    throw new Error('Invalid card number');
  }

  const normalizedCvv = card.cvv.replace(/\s+/g, '');
  if (!/^\d{3,4}$/.test(normalizedCvv)) {
    throw new Error('Invalid CVV');
  }

  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  if (!expiryMatch) {
    throw new Error('Invalid expiry format');
  }
  const expiryMonth = parseInt(expiryMatch[1], 10);
  const expiryYear = 2000 + parseInt(expiryMatch[2], 10);
  if (expiryMonth < 1 || expiryMonth > 12) {
    throw new Error('Invalid expiry format');
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    throw new Error('Expiry date is in the past');
  }

  if (!card.cardholderName || !card.cardholderName.trim()) {
    throw new Error('Cardholder name is required');
  }
}

let paymentIdCounter = 0;
function generatePaymentId(): string {
  paymentIdCounter += 1;
  return `payment-${Date.now()}-${paymentIdCounter}`;
}

export class PaymentService {
  constructor(
    private paymentRepository: IPaymentRepository,
    private orderRepository: IOrderRepository,
    private orderService: OrderService
  ) {}

  async pay(orderId: string, userId: string, idempotencyKey: string, card: CardInput): Promise<PayResult> {
    // Step 0 (mandatory, unconditional — tech-design.md §5): ownership check
    // runs BEFORE any idempotency-key lookup branch, so both the fresh-attempt
    // branch and the replay branch are ownership-checked. Previously only the
    // fresh-attempt branch validated order.userId === userId; the replay
    // branch returned another user's order/payment for a guessed/observed
    // idempotencyKey with no ownership check at all.
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new Error('Order not found or access denied');
    }

    // Step 1/2: idempotency-key replay branch — no new charge, no duplicate
    // order state change, just return the existing attempt's result.
    const existing = this.paymentRepository.findByIdempotencyKey(orderId, idempotencyKey);
    if (existing) {
      const currentOrder = await this.getOrderDTO(orderId, userId);
      return { order: currentOrder, payment: this.toSummary(existing) };
    }

    // Step 3: fresh attempt.
    if (order.status !== 'created') {
      throw new Error('Order cannot be paid in its current status');
    }

    validateCard(card);

    // Server-side, single source of truth for the charged amount — note the
    // second argument is order.promo?.id (a string), NOT order.promo (the
    // full PromoEntity object). See tech-design.md §4.3/§5.
    const amount = this.orderService.calculateOrderTotal(
      order.products,
      order.promo?.id,
      order.deliveryMethod?.fee ?? 0
    );

    const now = Date.now();
    let record: PaymentRecord = {
      paymentId: generatePaymentId(),
      orderId,
      userId,
      idempotencyKey,
      method: 'card',
      cardNumber: card.cardNumber,
      expiry: card.expiry,
      cvv: card.cvv,
      cardholderName: card.cardholderName,
      amount,
      status: 'processing',
      createdAt: now,
      updatedAt: now
    };
    this.paymentRepository.create(record);

    const result = evaluateMockPayment(card.cardNumber);

    record = {
      ...record,
      status: result.outcome === 'succeeded' ? 'succeeded' : 'failed',
      failureReason: result.failureReason,
      updatedAt: Date.now()
    };
    this.paymentRepository.update(record);

    if (result.outcome === 'succeeded') {
      this.orderRepository.update({
        ...order,
        status: 'paid',
        paymentId: record.paymentId,
        paidAt: Date.now()
      });
    }

    const finalOrder = await this.getOrderDTO(orderId, userId);
    return { order: finalOrder, payment: this.toSummary(record) };
  }

  getSummaryForOrder(orderId: string): PaymentSummaryDTO | undefined {
    const attempts = this.paymentRepository.findByOrderId(orderId);
    if (attempts.length === 0) {
      return undefined;
    }

    const succeeded = [...attempts].reverse().find(attempt => attempt.status === 'succeeded');
    const latest = succeeded ?? attempts[attempts.length - 1];
    return this.toSummary(latest);
  }

  private async getOrderDTO(orderId: string, userId: string): Promise<OrderDTO> {
    const dto = await this.orderService.getOrderById(orderId, userId);
    if (!dto) {
      throw new Error('Order not found or access denied');
    }
    return dto;
  }

  private toSummary(payment: PaymentRecord): PaymentSummaryDTO {
    const normalizedNumber = payment.cardNumber.replace(/\s+/g, '');
    return {
      paymentId: payment.paymentId,
      status: payment.status,
      cardLast4: normalizedNumber.slice(-4),
      cardholderName: payment.cardholderName,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt
    };
  }
}
