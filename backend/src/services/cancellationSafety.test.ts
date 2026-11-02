import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockBankGateway } from '../integrations/mock/mockBankGateway';
import { MockFulfillmentService } from '../integrations/mock/mockFulfillmentService';
import { IntegrationUnavailableError } from '../integrations/interfaces';
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

type Refund = { status: 'refunded' | 'failed' };

// Lets a test hold an async call and release it later
const held = <T>() => {
  let release: (value: T) => void = () => undefined;
  const promise = new Promise<T>(resolve => { release = resolve; });
  return { promise, release: (value: T) => release(value) };
};

describe('cancellation never leaves money returned and goods shipped', () => {
  let orders: InMemoryOrderRepository;
  let bank: MockBankGateway;
  let fulfillment: MockFulfillmentService;
  let checkout: CheckoutService;
  let payments: PaymentService;
  let processing: ProcessingService;
  let cancellation: CancellationService;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    const geo = new MockGeoService(0);
    bank = new MockBankGateway(0);
    // Jobs run for a long time, so a cancellation can catch them
    fulfillment = new MockFulfillmentService(geo, 60000, 0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    payments = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, new PromoService(new InMemoryPromoRepository()), payments);
    processing = new ProcessingService(orders, orderService, fulfillment, 50);
    cancellation = new CancellationService(orders, orderService, payments, bank, fulfillment, 50);

    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
    await payments.payOrder('order-2', 'user-1', { cardToken: 'tok_approve_test', expectedTotal: 30000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cancel = () => cancellation.cancelOrder('order-2', 'user-1');
  const record = () => orders.findById('order-2')!;

  it('stops the fulfillment job before refunding an order in processing', async () => {
    await processing.tick();
    const jobId = record().fulfillment!.jobId;
    const stop = vi.spyOn(fulfillment, 'cancel');

    expect((await cancel()).status).toBe('cancelled');
    expect(stop).toHaveBeenCalledWith(jobId);
    expect(await fulfillment.getStatus(jobId)).toEqual({ status: 'cancelled' });
  });

  it('refuses the cancellation without a refund when the job already finished', async () => {
    await processing.tick();
    vi.spyOn(fulfillment, 'cancel').mockResolvedValue({ status: 'too_late' });
    const refund = vi.spyOn(bank, 'refund');

    await expect(cancel()).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(refund).not.toHaveBeenCalled();
    expect(record().cancelRequested).toBeFalsy();
  });

  it('stops a job the worker started for an order that was cancelled meanwhile', async () => {
    const start = held<{ jobId: string }>();
    vi.spyOn(fulfillment, 'start').mockReturnValueOnce(start.promise);
    const stop = vi.spyOn(fulfillment, 'cancel');

    const pass = processing.tick();
    expect((await cancel()).status).toBe('cancelled');
    start.release({ jobId: 'job_late' });
    await pass;

    expect(stop).toHaveBeenCalledWith('job_late');
    expect(record().status).toBe('cancelled');
  });

  it('does not restart processing while a cancellation is running', async () => {
    await processing.tick();
    orders.update({ ...record(), fulfillment: { ...record().fulfillment!, failed: true } });
    const refund = held<Refund>();
    vi.spyOn(bank, 'refund').mockReturnValueOnce(refund.promise);
    const start = vi.spyOn(fulfillment, 'start');

    const cancelling = cancel();
    await expect(processing.retryProcessing('order-2', 'user-1')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    refund.release({ status: 'refunded' });

    expect((await cancelling).status).toBe('cancelled');
    expect(start).not.toHaveBeenCalled();
  });

  it('keeps the order out of processing when the refund answer is lost, then finishes the cancellation', async () => {
    vi.spyOn(bank, 'refund').mockImplementationOnce(async ({ paymentId }) => {
      // The bank refunds, but the answer never arrives
      await new MockBankGateway(0).refund({ paymentId, amountUsd: 0, idempotencyKey: 'x' });
      throw new IntegrationUnavailableError('Bank');
    });

    await expect(cancel()).rejects.toMatchObject({ code: 'REFUND_UNCONFIRMED' });
    expect(record().cancelRequested).toBe(true);

    await processing.tick();
    expect(record().status).toBe('paid');

    await cancellation.reconcileCancellations();
    expect(record().status).toBe('cancelled');
    expect(record().payment?.refunded).toBe(true);
  });

  it('releases the order and reports REFUND_FAILED on an unexpected bank error', async () => {
    vi.spyOn(bank, 'refund').mockRejectedValueOnce(new TypeError('bank bug'));

    await expect(cancel()).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    expect(record().cancelRequested).toBeFalsy();
    expect(record().status).toBe('paid');
  });

  it('gives a parallel cancellation the result of the running one', async () => {
    const refund = held<Refund>();
    const refundSpy = vi.spyOn(bank, 'refund').mockReturnValueOnce(refund.promise);

    const first = cancel();
    const second = cancel();
    refund.release({ status: 'failed' });

    await expect(first).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    await expect(second).rejects.toMatchObject({ code: 'REFUND_FAILED' });
    expect(refundSpy).toHaveBeenCalledTimes(1);
  });

  it('refunds the charged amount only', async () => {
    const charged = record().payment!;

    expect(await bank.refund({ paymentId: charged.paymentId!, amountUsd: 99999, idempotencyKey: 'wrong' })).toEqual({ status: 'failed' });
    expect(await bank.refund({ paymentId: charged.paymentId!, amountUsd: charged.amountUsd, idempotencyKey: 'right' })).toEqual({ status: 'refunded' });
  });
});
