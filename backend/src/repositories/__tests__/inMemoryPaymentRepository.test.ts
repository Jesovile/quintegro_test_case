import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryPaymentRepository } from '../implementations';
import { PaymentRecord } from '../../types/entities';

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    paymentId: 'payment-1',
    orderId: 'order-2',
    userId: 'user-1',
    idempotencyKey: 'idem-1',
    method: 'card',
    cardNumber: '4242424242424242',
    expiry: '09/27',
    cvv: '123',
    cardholderName: 'Jane Doe',
    amount: 100,
    status: 'processing',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  };
}

describe('InMemoryPaymentRepository', () => {
  let repository: InMemoryPaymentRepository;

  beforeEach(() => {
    repository = new InMemoryPaymentRepository();
  });

  it('create then findById returns the same record', () => {
    const payment = makePayment();
    repository.create(payment);

    expect(repository.findById('payment-1')).toEqual(payment);
  });

  it('findByOrderId returns all attempts for an order, including failed ones', () => {
    const succeeded = makePayment({ paymentId: 'payment-1', status: 'succeeded' });
    const failed = makePayment({ paymentId: 'payment-2', idempotencyKey: 'idem-2', status: 'failed' });
    const otherOrder = makePayment({ paymentId: 'payment-3', orderId: 'order-99', idempotencyKey: 'idem-3' });

    repository.create(succeeded);
    repository.create(failed);
    repository.create(otherOrder);

    const results = repository.findByOrderId('order-2');
    expect(results).toHaveLength(2);
    expect(results.map(p => p.paymentId).sort()).toEqual(['payment-1', 'payment-2']);
  });

  it('findByIdempotencyKey returns undefined for an unknown key', () => {
    repository.create(makePayment());
    expect(repository.findByIdempotencyKey('order-2', 'unknown-key')).toBeUndefined();
  });

  it('findByIdempotencyKey returns the correct record for a known (orderId, key) pair', () => {
    const payment = makePayment();
    repository.create(payment);
    expect(repository.findByIdempotencyKey('order-2', 'idem-1')).toEqual(payment);
  });

  it('findByIdempotencyKey returns undefined for a different orderId even with the same key', () => {
    repository.create(makePayment({ orderId: 'order-2', idempotencyKey: 'idem-1' }));
    expect(repository.findByIdempotencyKey('order-99', 'idem-1')).toBeUndefined();
  });

  it('update replaces the record with matching paymentId', () => {
    const payment = makePayment();
    repository.create(payment);

    const updated: PaymentRecord = { ...payment, status: 'succeeded', updatedAt: payment.updatedAt + 1 };
    repository.update(updated);

    expect(repository.findById('payment-1')).toEqual(updated);
  });

  it('reset empties the store', () => {
    repository.create(makePayment());
    repository.reset();

    expect(repository.findById('payment-1')).toBeUndefined();
    expect(repository.findByOrderId('order-2')).toEqual([]);
  });
});
