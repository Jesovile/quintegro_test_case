import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository } from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockFulfillmentService } from '../integrations/mock/mockFulfillmentService';
import { IntegrationUnavailableError } from '../integrations/interfaces';
import { OrderService } from './orderService';
import { ProcessingService } from './processingService';

describe('processing of paid orders', () => {
  let orders: InMemoryOrderRepository;
  let geo: MockGeoService;
  let fulfillment: MockFulfillmentService;
  let processing: ProcessingService;

  // A paid order with a delivery address, as left by payOrder
  const payOrderWithAddress = async (line1: string) => {
    const result = await geo.validateAddress({ line1, city: 'Springfield', state: 'IL', zip: '62701' });
    const addressRef = result.ok ? result.addressRef : '';
    const order = orders.findById('order-2')!;
    orders.update({
      ...order,
      status: 'paid',
      contact: { fullName: 'John Doe', email: 'john@example.com', phone: '5551234567' },
      addressRef,
      payment: { idempotencyKey: 'key', amountUsd: 30000, paymentId: 'pay_1' }
    });
  };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    geo = new MockGeoService(0);
    fulfillment = new MockFulfillmentService(geo, 0, 0);
    processing = new ProcessingService(orders, new OrderService(orders, new InMemoryProductRepository()), fulfillment, 50);
  });

  afterEach(() => {
    processing.stopWorker();
    vi.restoreAllMocks();
  });

  it('starts processing a paid order on its own and finishes with delivery (AC-4.1, AC-4.2)', async () => {
    await payOrderWithAddress('1 Main St');

    await processing.tick();
    expect(orders.findById('order-2')?.status).toBe('processing');

    await processing.tick();
    expect(orders.findById('order-2')?.status).toBe('deliver');
  });

  it('keeps a failed job in processing and lets the user retry (AC-4.4)', async () => {
    await payOrderWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();

    const failed = new OrderService(orders, new InMemoryProductRepository()).toDTO(orders.findById('order-2')!);
    expect(failed.status).toBe('processing');
    expect(failed.processingFailed).toBe(true);

    // The mock fails only the first job of the order; the retry starts a new one
    const retried = await processing.retryProcessing('order-2', 'user-1');

    expect(retried.processingFailed).toBe(false);
    await processing.tick();
    expect(orders.findById('order-2')?.status).toBe('deliver');
  });

  it('keeps a paid order paid while the fulfillment service is down and starts it later', async () => {
    await payOrderWithAddress('1 Main St');
    const start = vi.spyOn(fulfillment, 'start').mockRejectedValueOnce(new IntegrationUnavailableError('Fulfillment service'));

    await processing.tick();
    expect(orders.findById('order-2')?.status).toBe('paid');

    await processing.tick();
    expect(start).toHaveBeenCalledTimes(2);
    expect(orders.findById('order-2')?.status).toBe('processing');
  });

  it('ignores an old job after a retry started a new one', async () => {
    await payOrderWithAddress('1 Main St');
    await processing.tick();
    const order = orders.findById('order-2')!;
    orders.update({ ...order, fulfillment: { jobId: 'job_new', failed: false, attempt: 2 } });
    vi.spyOn(fulfillment, 'getStatus').mockImplementation(async jobId => ({ status: jobId === 'job_new' ? 'running' : 'done' }));

    await processing.tick();

    expect(orders.findById('order-2')?.status).toBe('processing');
  });

  it('runs on a timer without any client', async () => {
    await payOrderWithAddress('1 Main St');

    processing.startWorker(5);
    await vi.waitFor(() => expect(orders.findById('order-2')?.status).toBe('deliver'), { timeout: 1000 });
  });

  it('starts one job for parallel retries', async () => {
    await payOrderWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();
    const start = vi.spyOn(fulfillment, 'start');

    const [first, second] = await Promise.all([processing.retryProcessing('order-2', 'user-1'), processing.retryProcessing('order-2', 'user-1')]);

    expect(start).toHaveBeenCalledTimes(1);
    expect(first.processingFailed).toBe(false);
    expect(second.status).toBe('processing');
  });

  it('repeats a start whose answer was lost with the same idempotency key', async () => {
    await payOrderWithAddress('1 Main St');
    const start = vi.spyOn(fulfillment, 'start').mockRejectedValueOnce(new IntegrationUnavailableError('Fulfillment service'));

    await processing.tick();
    await processing.tick();

    const keys = start.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps processing other orders when one of them fails unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await payOrderWithAddress('1 Main St');
    const broken = { ...orders.findById('order-2')!, orderId: 'order-broken' };
    vi.spyOn(orders, 'findAll').mockReturnValue([broken, orders.findById('order-2')!]);
    vi.spyOn(fulfillment, 'start').mockImplementation(async ({ orderId }) => {
      if (orderId === 'order-broken') {
        throw new TypeError('bug');
      }
      return { jobId: 'job_ok' };
    });

    await processing.tick();

    expect(orders.findById('order-2')?.status).toBe('processing');
  });

  it('returns a delivered order on a late retry instead of an error', async () => {
    await payOrderWithAddress('1 Main St');
    await processing.tick();
    await processing.tick();

    expect((await processing.retryProcessing('order-2', 'user-1')).status).toBe('deliver');
  });

  it('refuses retries for other users and orders that did not fail', async () => {
    await payOrderWithAddress('1 Main St');

    await expect(processing.retryProcessing('order-2', 'user-2')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    await expect(processing.retryProcessing('order-2', 'user-1')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });

    await processing.tick();
    expect((await processing.retryProcessing('order-2', 'user-1')).status).toBe('processing');
  });
});
