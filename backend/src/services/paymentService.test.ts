import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockBankGateway } from '../integrations/mock/mockBankGateway';
import { OrderService } from './orderService';
import { PromoService } from './promoService';
import { CheckoutService } from './checkoutService';
import { PaymentService } from './paymentService';

const delivery = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

const APPROVE = 'tok_approve_test';
const DECLINE = 'tok_decline_test';
const TIMEOUT = 'tok_timeout_test';

describe('payOrder', () => {
  let orders: InMemoryOrderRepository;
  let geo: MockGeoService;
  let bank: MockBankGateway;
  let checkout: CheckoutService;
  let payments: PaymentService;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    geo = new MockGeoService(0);
    bank = new MockBankGateway(0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    payments = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, new PromoService(new InMemoryPromoRepository()), payments);

    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const pay = (cardToken: string, expectedTotal = 30000) =>
    payments.payOrder('order-2', 'user-1', { cardToken, expectedTotal });

  it('charges the server total and moves the order to paid (AC-3.2)', async () => {
    const charge = vi.spyOn(bank, 'charge');

    const result = await pay(APPROVE);

    expect(result.status).toBe('paid');
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: 30000 }));
    const record = orders.findById('order-2');
    expect(record?.payment).toMatchObject({ amountUsd: 30000 });
    expect(record?.payment?.paymentId).toMatch(/^pay_/);
    expect(JSON.stringify(record)).not.toContain('tok_');
  });

  it('keeps the order in checkout after a decline and charges anew with another card (AC-3.3)', async () => {
    await expect(pay(DECLINE)).rejects.toMatchObject({ code: 'PAYMENT_DECLINED' });
    expect(orders.findById('order-2')?.status).toBe('checkout');
    expect(orders.findById('order-2')?.payment).toBeUndefined();

    expect((await pay(APPROVE)).status).toBe('paid');
  });

  it('recovers a charge whose answer was lost without charging again (AC-3.4)', async () => {
    await expect(pay(TIMEOUT)).rejects.toMatchObject({ code: 'PAYMENT_UNCONFIRMED' });
    expect(orders.findById('order-2')?.status).toBe('checkout');
    const charge = vi.spyOn(bank, 'charge');

    const result = await pay(APPROVE);

    expect(result.status).toBe('paid');
    expect(charge).not.toHaveBeenCalled();
  });

  it('returns the paid order on a repeated request without a second charge (AC-3.6)', async () => {
    await pay(APPROVE);
    const charge = vi.spyOn(bank, 'charge');

    const again = await pay(APPROVE);

    expect(again.status).toBe('paid');
    expect(charge).not.toHaveBeenCalled();
  });

  it('charges once when two tabs pay at the same time (AC-3.6)', async () => {
    const charge = vi.spyOn(bank, 'charge');

    const [first, second] = await Promise.all([pay(APPROVE), pay(APPROVE)]);

    expect(first.status).toBe('paid');
    expect(second.status).toBe('paid');
    const keys = new Set(charge.mock.calls.map(([input]) => input.idempotencyKey));
    expect(keys.size).toBe(1);
  });

  it('does not charge when the total differs from what the user saw (AC-3.7)', async () => {
    const charge = vi.spyOn(bank, 'charge');

    await expect(pay(APPROVE, 29999)).rejects.toMatchObject({ code: 'TOTAL_CHANGED' });
    expect(charge).not.toHaveBeenCalled();
  });

  it('checks the promo again at payment: an expired promo changes the total (AC-3.7)', async () => {
    await checkout.applyPromo('order-2', 'user-1', 'SAVE10');
    const order = orders.findById('order-2')!;
    orders.update({ ...order, promo: { ...order.promo!, dueDate: Date.now() - 1000 } });

    await expect(pay(APPROVE, 27000)).rejects.toMatchObject({ code: 'TOTAL_CHANGED' });
    expect((await pay(APPROVE, 30000)).status).toBe('paid');
  });

  it('requires saved delivery and an existing address', async () => {
    await geo.deleteAddress(orders.findById('order-2')!.addressRef!);
    await expect(pay(APPROVE)).rejects.toMatchObject({ code: 'ADDRESS_NOT_FOUND' });

    const order = orders.findById('order-2')!;
    orders.update({ ...order, contact: undefined, addressRef: undefined });
    await expect(pay(APPROVE)).rejects.toMatchObject({ code: 'DELIVERY_REQUIRED' });
  });

  it('refuses other users and orders outside checkout', async () => {
    await expect(payments.payOrder('order-2', 'user-2', { cardToken: APPROVE, expectedTotal: 30000 })).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    await checkout.exitCheckout('order-2', 'user-1');
    await expect(pay(APPROVE)).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('locks promo and checkout exit after payment', async () => {
    await pay(APPROVE);

    await expect(checkout.applyPromo('order-2', 'user-1', 'SAVE10')).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    await expect(checkout.exitCheckout('order-2', 'user-1')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });
});
