import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentService } from '../paymentService';
import { OrderService } from '../orderService';
import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  InMemoryDeliveryMethodRepository,
  InMemoryPaymentRepository
} from '../../repositories/implementations';
import { MAGIC_DECLINE_CARD_NUMBER } from '../mockPaymentProvider';

const VALID_CARD = {
  cardNumber: '4242424242424242',
  expiry: '09/30',
  cvv: '123',
  cardholderName: 'Jane Doe'
};

describe('PaymentService.pay', () => {
  let paymentService: PaymentService;
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;
  let paymentRepository: InMemoryPaymentRepository;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    paymentRepository = new InMemoryPaymentRepository();

    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
    paymentService = new PaymentService(paymentRepository, orderRepository, orderService);
  });

  it("throws 'Order not found or access denied' for an order owned by a different user, even when a matching idempotencyKey exists for that order (ownership-check-first regression test)", async () => {
    // Seed a PaymentRecord directly via the fake repo for order-2/user-1 with a known key.
    paymentRepository.create({
      paymentId: 'payment-seed',
      orderId: 'order-2',
      userId: 'user-1',
      idempotencyKey: 'shared-key',
      method: 'card',
      cardNumber: VALID_CARD.cardNumber,
      expiry: VALID_CARD.expiry,
      cvv: VALID_CARD.cvv,
      cardholderName: VALID_CARD.cardholderName,
      amount: 100,
      status: 'succeeded',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await expect(
      paymentService.pay('order-2', 'user-2', 'shared-key', VALID_CARD)
    ).rejects.toThrow('Order not found or access denied');
  });

  it('calling pay twice with the same idempotencyKey creates exactly one PaymentRecord and both calls return the same payment.paymentId', async () => {
    const first = await paymentService.pay('order-2', 'user-1', 'idem-key', VALID_CARD);
    const second = await paymentService.pay('order-2', 'user-1', 'idem-key', VALID_CARD);

    expect(paymentRepository.findByOrderId('order-2')).toHaveLength(1);
    expect(first.payment.paymentId).toBe(second.payment.paymentId);
  });

  it('calling pay twice with two different idempotencyKeys (explicit retry) creates two separate PaymentRecords', async () => {
    await paymentService.pay('order-2', 'user-1', MAGIC_DECLINE_CARD_NUMBER, {
      ...VALID_CARD,
      cardNumber: MAGIC_DECLINE_CARD_NUMBER
    });

    // First attempt failed (order stays 'created'), retry with a fresh key and a good card.
    await paymentService.pay('order-2', 'user-1', 'retry-key', VALID_CARD);

    expect(paymentRepository.findByOrderId('order-2')).toHaveLength(2);
  });

  it('magic decline card number results in payment.status failed and order status remains created', async () => {
    const result = await paymentService.pay('order-2', 'user-1', 'idem-1', {
      ...VALID_CARD,
      cardNumber: MAGIC_DECLINE_CARD_NUMBER
    });

    expect(result.payment.status).toBe('failed');
    expect(result.order.status).toBe('created');
  });

  it('any other well-formed card number succeeds, order becomes paid with paymentId/paidAt set', async () => {
    const result = await paymentService.pay('order-2', 'user-1', 'idem-1', VALID_CARD);

    expect(result.payment.status).toBe('succeeded');
    expect(result.order.status).toBe('paid');

    const persisted = orderRepository.findById('order-2')!;
    expect(persisted.status).toBe('paid');
    expect(persisted.paymentId).toBe(result.payment.paymentId);
    expect(persisted.paidAt).toBeDefined();
  });

  it('malformed card throws a validation error before any PaymentRecord is created', async () => {
    await expect(
      paymentService.pay('order-2', 'user-1', 'idem-1', { ...VALID_CARD, cardNumber: 'abc' })
    ).rejects.toThrow();

    expect(paymentRepository.findByOrderId('order-2')).toEqual([]);
  });

  it('rejects an expiry with an out-of-range month (regression: shape-only regex previously accepted "13/30")', async () => {
    await expect(
      paymentService.pay('order-2', 'user-1', 'idem-1', { ...VALID_CARD, expiry: '13/30' })
    ).rejects.toThrow('Invalid expiry format');

    expect(paymentRepository.findByOrderId('order-2')).toEqual([]);
  });

  it('rejects an already-expired expiry date (regression: shape-only regex previously accepted a past date)', async () => {
    await expect(
      paymentService.pay('order-2', 'user-1', 'idem-1', { ...VALID_CARD, expiry: '01/20' })
    ).rejects.toThrow('Expiry date is in the past');

    expect(paymentRepository.findByOrderId('order-2')).toEqual([]);
  });

  it("pay on an order not in 'created' status throws without creating a new PaymentRecord", async () => {
    // order-1 is seeded with status 'finished'
    await expect(
      paymentService.pay('order-1', 'user-1', 'idem-1', VALID_CARD)
    ).rejects.toThrow('Order cannot be paid in its current status');

    expect(paymentRepository.findByOrderId('order-1')).toEqual([]);
  });

  it('getSummaryForOrder returns a cardLast4 (not the full card number) and never includes cvv', async () => {
    await paymentService.pay('order-2', 'user-1', 'idem-1', VALID_CARD);

    const summary = paymentService.getSummaryForOrder('order-2')!;
    expect(summary.cardLast4).toBe(VALID_CARD.cardNumber.slice(-4));
    expect((summary as any).cvv).toBeUndefined();
    expect((summary as any).cardNumber).toBeUndefined();
  });

  it("no/invalid token isn't this service's concern directly, but the resolver-level test covers that; here we verify a missing order also throws the ownership-style error", async () => {
    await expect(
      paymentService.pay('order-does-not-exist', 'user-1', 'idem-1', VALID_CARD)
    ).rejects.toThrow('Order not found or access denied');
  });

  it('order carrying an active, non-expired promo produces payment.amount === (subtotal - discount) + deliveryFee (plan-review M2 regression)', async () => {
    // Seed an order with a promo and a delivery method fee directly via the repo,
    // owned by user-1, in 'created' status.
    orderRepository.update({
      orderId: 'order-2',
      userId: 'user-1',
      status: 'created',
      createAt: Date.now(),
      products: [
        { id: 'product-2', amount: 1, price: 899.99 },
        { id: 'product-4', amount: 1, price: 599.99 }
      ],
      promo: { id: 'SAVE10', discount: 10, dueDate: Date.now() + 1000 * 60 * 60 },
      deliveryMethod: { type: 'regular', fee: 5.99, estimatedDays: '3-5' }
    });

    const result = await paymentService.pay('order-2', 'user-1', 'idem-1', VALID_CARD);

    const subtotal = 899.99 + 599.99;
    const discount = subtotal * 0.1;
    const expectedAmount = subtotal - discount + 5.99;

    const persisted = orderRepository.findById('order-2')!;
    const paymentRecord = paymentRepository.findById(persisted.paymentId!)!;
    expect(paymentRecord.amount).toBeCloseTo(expectedAmount, 2);
  });
});
