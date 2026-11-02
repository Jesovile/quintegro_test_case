import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { ChargeResult, IBankGateway, PaymentLookup } from '../integrations/interfaces';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { OrderService } from './orderService';
import { PromoService } from './promoService';
import { CheckoutService } from './checkoutService';
import { PaymentService } from './paymentService';

// A bank whose answers the test releases explicitly
class ControlledBank implements IBankGateway {
  private charges = new Map<string, { paymentId: string; amountUsd: number }>();
  private refunded = new Set<string>();
  private counter = 0;
  private held: Array<() => void> = [];
  holdCharges = false;
  loseAnswers = false;
  refundStatus: 'refunded' | 'failed' = 'refunded';
  chargeCalls: Array<{ amountUsd: number; idempotencyKey: string }> = [];
  refundCalls: string[] = [];

  async charge({ amountUsd, idempotencyKey }: { cardToken: string; amountUsd: number; idempotencyKey: string }): Promise<ChargeResult> {
    this.chargeCalls.push({ amountUsd, idempotencyKey });
    const apply = (): ChargeResult => {
      const existing = this.charges.get(idempotencyKey) ?? { paymentId: `pay_${++this.counter}`, amountUsd };
      this.charges.set(idempotencyKey, existing);
      return { status: 'approved', paymentId: existing.paymentId };
    };
    if (this.loseAnswers) {
      apply();
      return new Promise<ChargeResult>(() => undefined);
    }
    if (this.holdCharges) {
      return new Promise<ChargeResult>(resolve => this.held.push(() => resolve(apply())));
    }
    return apply();
  }

  releaseCharges(): void {
    this.held.splice(0).forEach(release => release());
  }

  async getPaymentByKey(idempotencyKey: string): Promise<PaymentLookup> {
    const charge = this.charges.get(idempotencyKey);
    return charge
      ? { status: 'approved', paymentId: charge.paymentId, amountUsd: charge.amountUsd, refunded: this.refunded.has(charge.paymentId) }
      : { status: 'unknown' };
  }

  async refund({ paymentId }: { paymentId: string; amountUsd: number; idempotencyKey: string }): Promise<{ status: 'refunded' | 'failed' }> {
    this.refundCalls.push(paymentId);
    if (this.refundStatus === 'refunded') {
      this.refunded.add(paymentId);
    }
    return { status: this.refundStatus };
  }
}

const delivery = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};
const TOKEN = 'tok_approve_test';
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

describe('payment consistency with the bank', () => {
  let orders: InMemoryOrderRepository;
  let bank: ControlledBank;
  let checkout: CheckoutService;
  let payments: PaymentService;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    bank = new ControlledBank();
    const geo = new MockGeoService(0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    payments = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, new PromoService(new InMemoryPromoRepository()), payments);

    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const pay = (expectedTotal = 30000, cardToken = TOKEN) =>
    payments.payOrder('order-2', 'user-1', { cardToken, expectedTotal });

  it('never marks an order paid with a charge that was refunded', async () => {
    bank.holdCharges = true;
    const paying = pay();
    await tick();
    await checkout.exitCheckout('order-2', 'user-1');
    bank.releaseCharges();

    await expect(paying).rejects.toMatchObject({ code: 'PAYMENT_REFUNDED' });
    expect(bank.refundCalls).toHaveLength(1);

    bank.holdCharges = false;
    await checkout.startCheckout('order-2', 'user-1');
    const paid = await pay();

    expect(paid.status).toBe('paid');
    expect(orders.findById('order-2')?.payment?.paymentId).not.toBe(bank.refundCalls[0]);
    expect(new Set(bank.chargeCalls.map(call => call.idempotencyKey)).size).toBe(2);
  });

  it('settles a charge whose answer was lost before the order can be changed', async () => {
    bank.loseAnswers = true;
    await expect(pay()).rejects.toMatchObject({ code: 'PAYMENT_UNCONFIRMED' });

    await expect(checkout.exitCheckout('order-2', 'user-1')).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });

    const record = orders.findById('order-2');
    expect(record?.status).toBe('paid');
    expect(record?.payment?.amountUsd).toBe(30000);
    expect(bank.refundCalls).toHaveLength(0);
  });

  it('refunds a charge that lands after the user changed the order, then charges the new total', async () => {
    bank.holdCharges = true;
    const paying = pay();
    await tick();
    await checkout.applyPromo('order-2', 'user-1', 'SAVE10');
    bank.releaseCharges();

    await expect(paying).rejects.toMatchObject({ code: 'PAYMENT_REFUNDED' });
    expect(orders.findById('order-2')?.status).toBe('checkout');

    bank.holdCharges = false;
    const paid = await pay(27000);

    expect(paid.status).toBe('paid');
    expect(orders.findById('order-2')?.payment?.amountUsd).toBe(27000);
    expect(bank.chargeCalls.map(call => call.amountUsd)).toEqual([30000, 27000]);
  });

  it('keeps a failed refund for a retry and tells the user', async () => {
    bank.holdCharges = true;
    bank.refundStatus = 'failed';
    const paying = pay();
    await tick();
    await checkout.exitCheckout('order-2', 'user-1');
    bank.releaseCharges();

    await expect(paying).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    expect(orders.findById('order-2')?.refundsPending).toEqual([{ paymentId: 'pay_1', amountUsd: 30000 }]);
  });

  it('lets a delivery change win over an unanswered payment and refunds the late charge', async () => {
    bank.holdCharges = true;
    const paying = pay();
    await tick();

    await checkout.saveDelivery('order-2', 'user-1', { ...delivery, phone: '5559876543' });
    bank.releaseCharges();

    await expect(paying).rejects.toMatchObject({ code: 'PAYMENT_REFUNDED' });
    expect(orders.findById('order-2')?.contact?.phone).toBe('5559876543');
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('refuses a change that would land while a new payment attempt is being charged', async () => {
    // The attempt appears between the change's own check and its write
    const settle = vi.spyOn(payments, 'settlePendingPayment').mockResolvedValue('clear');
    bank.holdCharges = true;
    const paying = pay();
    await tick();

    await expect(checkout.applyPromo('order-2', 'user-1', 'SAVE10')).rejects.toMatchObject({ code: 'PAYMENT_IN_PROGRESS' });
    settle.mockRestore();
    bank.releaseCharges();
    expect((await paying).status).toBe('paid');
  });

  it('rejects a malformed card token before calling the bank', async () => {
    await expect(pay(30000, 'x'.repeat(300))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(pay(30000, 'tok approve')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(bank.chargeCalls).toHaveLength(0);
  });
});
