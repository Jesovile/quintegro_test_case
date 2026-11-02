import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { createContainer } from '../container';
import { createApolloServer } from './server';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockBankGateway } from '../integrations/mock/mockBankGateway';
import { MockFulfillmentService } from '../integrations/mock/mockFulfillmentService';
import { OrderService } from '../services/orderService';
import { PromoService } from '../services/promoService';
import { CheckoutService } from '../services/checkoutService';
import { PaymentService } from '../services/paymentService';
import { ProcessingService } from '../services/processingService';
import { CancellationService } from '../services/cancellationService';

const delivery = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

const PAY = `mutation Pay($orderId: ID!, $input: PayOrderInput!) { payOrder(orderId: $orderId, input: $input) { status } }`;
const CANCEL = (id = 'order-2') => `mutation { cancelOrder(orderId: "${id}") { orderId status } }`;
const LIST = 'query { orders { orderId status totals { total } promo { id } products { amount price } } }';

describe('cancelOrder over GraphQL (slice 8)', () => {
  const { authService } = createContainer();
  let orders: InMemoryOrderRepository;
  let bank: MockBankGateway;
  let checkout: CheckoutService;
  let processing: ProcessingService;
  let server: ReturnType<typeof createApolloServer>;
  let owner: { req: Request };
  let stranger: { req: Request };

  const ctxFor = (token: string | null) => ({
    req: { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request
  });
  const run = (query: string, context = owner) => server.executeOperation({ query }, context);
  const code = (result: Awaited<ReturnType<typeof run>>) => result.errors?.[0].extensions?.code;

  const startAndSave = async () => {
    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
  };
  const pay = async () => {
    const result = await server.executeOperation(
      { query: PAY, variables: { orderId: 'order-2', input: { cardToken: 'tok_approve_1', expectedTotal: 30000 } } },
      owner
    );
    expect(result.errors).toBeUndefined();
  };

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    const geo = new MockGeoService(0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    const promoService = new PromoService(new InMemoryPromoRepository());
    bank = new MockBankGateway(0);
    const paymentService = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, promoService, paymentService);
    // Jobs keep running, so a cancellation can still stop them
    const fulfillment = new MockFulfillmentService(geo, 60000, 0);
    processing = new ProcessingService(orders, orderService, fulfillment, 50);
    const cancellationService = new CancellationService(orders, orderService, paymentService, bank, fulfillment, 50);
    server = createApolloServer({ orderService, checkoutService: checkout, paymentService, processingService: processing, cancellationService, promoService, authService });
    owner = ctxFor(await authService.authenticateUser('john.doe', 'password123'));
    stranger = ctxFor(await authService.authenticateUser('jane.smith', 'password456'));
  });

  afterEach(() => {
    processing.stopWorker();
    vi.restoreAllMocks();
  });

  it('AC-5.1: cancelling an order in checkout returns status cancelled', async () => {
    await startAndSave();
    const refund = vi.spyOn(bank, 'refund');

    const result = await run(CANCEL());

    expect(result.errors).toBeUndefined();
    expect(result.data?.cancelOrder).toEqual({ orderId: 'order-2', status: 'cancelled' });
    expect(refund).not.toHaveBeenCalled();
  });

  it('AC-5.2: cancelling a paid order refunds and returns cancelled', async () => {
    await startAndSave();
    await pay();
    const refund = vi.spyOn(bank, 'refund');

    const result = await run(CANCEL());

    expect(result.errors).toBeUndefined();
    expect(result.data?.cancelOrder).toMatchObject({ status: 'cancelled' });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('AC-5.3: REFUND_FAILED keeps the status, a retry then succeeds', async () => {
    await startAndSave();
    await pay();
    vi.spyOn(bank, 'refund').mockResolvedValueOnce({ status: 'failed' });

    expect(code(await run(CANCEL()))).toBe('REFUND_FAILED');
    expect(orders.findById('order-2')?.status).toBe('paid');

    const retried = await run(CANCEL());
    expect(retried.errors).toBeUndefined();
    expect(retried.data?.cancelOrder).toMatchObject({ status: 'cancelled' });
  });

  it('AC-5.3: an unanswered refund keeps the order and is confirmed later (REFUND_UNCONFIRMED)', async () => {
    await startAndSave();
    await pay();
    const { IntegrationUnavailableError } = await import('../integrations/interfaces');
    vi.spyOn(bank, 'refund').mockRejectedValueOnce(new IntegrationUnavailableError('Bank'));

    expect(code(await run(CANCEL()))).toBe('REFUND_UNCONFIRMED');
    expect(orders.findById('order-2')?.status).toBe('paid');
  });

  it('AC-5.4: ORDER_NOT_CANCELLABLE for a delivered order and for a created one', async () => {
    expect(code(await run(CANCEL('order-1')))).toBe('ORDER_NOT_CANCELLABLE');
    expect(code(await run(CANCEL()))).toBe('ORDER_NOT_CANCELLABLE'); // order-2 is still created
    expect(orders.findById('order-2')?.status).toBe('created');
  });

  it('AC-5.4: a delivered order stays delivered after the rejected cancellation', async () => {
    await startAndSave();
    await pay();
    await processing.tick();
    // The fulfillment job has finished and the order was handed over for delivery
    orders.update({ ...orders.findById('order-2')!, status: 'deliver' });

    expect(code(await run(CANCEL()))).toBe('ORDER_NOT_CANCELLABLE');
    expect(orders.findById('order-2')?.status).toBe('deliver');
  });

  it('AC-5.5: a repeated cancelOrder succeeds and refunds only once', async () => {
    await startAndSave();
    await pay();
    const refund = vi.spyOn(bank, 'refund');

    await run(CANCEL());
    const again = await run(CANCEL());

    expect(again.errors).toBeUndefined();
    expect(again.data?.cancelOrder).toMatchObject({ status: 'cancelled' });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('ORDER_NOT_FOUND: another user and an unknown order look the same, nothing changes', async () => {
    await startAndSave();

    const foreign = await run(CANCEL(), stranger);
    const unknown = await run(CANCEL('order-nope'));

    expect(code(foreign)).toBe('ORDER_NOT_FOUND');
    expect(code(unknown)).toBe('ORDER_NOT_FOUND');
    expect(unknown.errors?.[0].message).toBe(foreign.errors?.[0].message);
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('UNAUTHENTICATED without a token or with a bad one, the service is not called', async () => {
    await startAndSave();

    expect(code(await run(CANCEL(), ctxFor(null)))).toBe('UNAUTHENTICATED');
    expect(code(await run(CANCEL(), ctxFor('garbage')))).toBe('UNAUTHENTICATED');
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('AC-7.2, AC-7.3: a cancelled order is listed in orders with status cancelled, total and promo', async () => {
    await startAndSave();
    await checkout.applyPromo('order-2', 'user-1', 'SAVE10');
    await server.executeOperation(
      { query: PAY, variables: { orderId: 'order-2', input: { cardToken: 'tok_approve_1', expectedTotal: 27000 } } },
      owner
    );
    await processing.tick(); // processing: History allows cancelling here (AC-7.3)
    expect((await run(CANCEL())).errors).toBeUndefined();

    const list = (await run(LIST)).data?.orders as { orderId: string; status: string; totals: { total: number }; promo: { id: string } }[];

    expect(list.find(o => o.orderId === 'order-2')).toMatchObject({ status: 'cancelled', totals: { total: 27000 }, promo: { id: 'SAVE10' } });
  });

  it('AC-5.6: after a cancellation the worker never moves the order to deliver', async () => {
    await startAndSave();
    await pay();
    await run(CANCEL());

    await processing.tick();
    await processing.tick();

    expect(orders.findById('order-2')?.status).toBe('cancelled');
  });

  it('AC-5.6: cancelling in parallel with processing ends in exactly one final status', async () => {
    await startAndSave();
    await pay();
    await processing.tick();

    const [cancelled] = await Promise.all([run(CANCEL()), processing.tick()]);
    await processing.tick();

    const final = orders.findById('order-2')?.status;
    if (cancelled.errors) {
      expect(code(cancelled)).toBe('ORDER_NOT_CANCELLABLE');
      expect(final).toBe('deliver');
    } else {
      expect(final).toBe('cancelled');
    }
  });
});
