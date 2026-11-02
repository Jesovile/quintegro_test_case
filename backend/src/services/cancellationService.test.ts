import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockBankGateway } from '../integrations/mock/mockBankGateway';
import { MockFulfillmentService } from '../integrations/mock/mockFulfillmentService';
import { OrderService } from './orderService';
import { PromoService } from './promoService';
import { CheckoutService } from './checkoutService';
import { PaymentService } from './paymentService';
import { ProcessingService } from './processingService';
import { CancellationService } from './cancellationService';

const delivery = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

describe('order cancellation', () => {
  let orders: InMemoryOrderRepository;
  let bank: MockBankGateway;
  let checkout: CheckoutService;
  let payments: PaymentService;
  let processing: ProcessingService;
  let cancellation: CancellationService;
  let fulfillment: MockFulfillmentService;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    const geo = new MockGeoService(0);
    bank = new MockBankGateway(0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    payments = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, new PromoService(new InMemoryPromoRepository()), payments);
    // Jobs keep running, so a cancellation can still stop them
    fulfillment = new MockFulfillmentService(geo, 60000, 0);
    processing = new ProcessingService(orders, orderService, fulfillment, 50);
    cancellation = new CancellationService(orders, orderService, payments, bank, fulfillment, 50);

    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const pay = (cardToken = 'tok_approve_test') => payments.payOrder('order-2', 'user-1', { cardToken, expectedTotal: 30000 });
  const cancel = () => cancellation.cancelOrder('order-2', 'user-1');
  const status = () => orders.findById('order-2')?.status;

  it('cancels an order in checkout without a refund (AC-5.1)', async () => {
    const refund = vi.spyOn(bank, 'refund');

    expect((await cancel()).status).toBe('cancelled');
    expect(refund).not.toHaveBeenCalled();
  });

  it('refunds a paid order and cancels it (AC-5.2)', async () => {
    await pay();
    const refund = vi.spyOn(bank, 'refund');

    expect((await cancel()).status).toBe('cancelled');
    expect(refund).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: 30000 }));
  });

  it('refunds an order in processing and cancels it (AC-5.2)', async () => {
    await pay();
    await processing.tick();
    expect(status()).toBe('processing');

    expect((await cancel()).status).toBe('cancelled');
  });

  it('keeps the status when the refund fails and lets the user try again (AC-5.3)', async () => {
    await pay();
    vi.spyOn(bank, 'refund').mockResolvedValueOnce({ status: 'failed' });

    await expect(cancel()).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    expect(status()).toBe('paid');
    expect(orders.findById('order-2')?.cancelRequested).toBe(false);

    expect((await cancel()).status).toBe('cancelled');
  });

  it('refuses to cancel a delivered or a not yet started order (AC-5.4)', async () => {
    await checkout.exitCheckout('order-2', 'user-1');
    await expect(cancel()).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });

    await expect(cancellation.cancelOrder('order-1', 'user-1')).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
  });

  it('refunds once for repeated and parallel cancellations (AC-5.5)', async () => {
    await pay();
    const refund = vi.spyOn(bank, 'refund');

    const [first, second] = await Promise.all([cancel(), cancel()]);
    const third = await cancel();

    expect(refund).toHaveBeenCalledTimes(1);
    expect(third.status).toBe('cancelled');
    expect([first.status, second.status]).toContain('cancelled');
  });

  it('does not let processing finish an order that is being cancelled (AC-5.6)', async () => {
    await pay();
    await processing.tick();
    let releaseRefund: () => void = () => undefined;
    const refund = vi.spyOn(bank, 'refund').mockImplementation(
      () => new Promise<{ status: 'refunded' | 'failed' }>(resolve => { releaseRefund = () => resolve({ status: 'refunded' }); })
    );

    const cancelling = cancel();
    // The cancellation first stops the job, then waits for the refund
    await vi.waitFor(() => expect(refund).toHaveBeenCalled());
    await processing.tick();
    expect(status()).toBe('processing');

    releaseRefund();
    expect((await cancelling).status).toBe('cancelled');
    await processing.tick();
    expect(status()).toBe('cancelled');
  });

  it('refuses the cancellation when processing delivered the order first (AC-5.6)', async () => {
    await pay();
    await processing.tick();
    vi.spyOn(fulfillment, 'getStatus').mockResolvedValue({ status: 'done' });
    await processing.tick();
    expect(status()).toBe('deliver');

    await expect(cancel()).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
  });

  it('settles an unanswered payment before cancelling and refunds the charge it finds', async () => {
    await expect(pay('tok_timeout_test')).rejects.toMatchObject({ code: 'PAYMENT_UNCONFIRMED' });
    const refund = vi.spyOn(bank, 'refund');

    expect((await cancel()).status).toBe('cancelled');
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('hides other users orders', async () => {
    await expect(cancellation.cancelOrder('order-2', 'user-2')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  it('retries refunds that the bank did not confirm earlier', async () => {
    await pay();
    const order = orders.findById('order-2')!;
    orders.update({ ...order, refundsPending: [{ paymentId: order.payment!.paymentId!, amountUsd: 30000 }] });

    await cancellation.retryPendingRefunds();

    expect(orders.findById('order-2')?.refundsPending).toEqual([]);
  });
});
