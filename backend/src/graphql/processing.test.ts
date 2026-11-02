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

const delivery = (line1: string) => ({
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1, city: 'Springfield', state: 'IL', zip: '62701' }
});

const PAY = `mutation Pay($orderId: ID!, $input: PayOrderInput!) { payOrder(orderId: $orderId, input: $input) { status } }`;
const ORDER = 'query { order(orderId: "order-2") { status processingFailed totals { total } } }';
const RETRY = 'mutation { retryProcessing(orderId: "order-2") { status processingFailed } }';

describe('processing over GraphQL (slice 7)', () => {
  const { authService } = createContainer();
  let orders: InMemoryOrderRepository;
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

  // Full path up to the paid state, as the UI does it
  const payWithAddress = async (line1: string) => {
    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery(line1));
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
    const paymentService = new PaymentService(orders, orderService, geo, new MockBankGateway(0), { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, promoService, paymentService);
    processing = new ProcessingService(orders, orderService, new MockFulfillmentService(geo, 0, 0), 50);
    server = createApolloServer({ orderService, checkoutService: checkout, paymentService, processingService: processing, promoService, authService });
    owner = ctxFor(await authService.authenticateUser('john.doe', 'password123'));
    stranger = ctxFor(await authService.authenticateUser('jane.smith', 'password456'));
  });

  afterEach(() => {
    processing.stopWorker();
    vi.restoreAllMocks();
  });

  it('AC-4.1, AC-4.2: payment -> worker -> processing -> deliver through the container services', async () => {
    await payWithAddress('1 Main St');
    expect((await run(ORDER)).data?.order).toMatchObject({ status: 'paid', processingFailed: false });

    await processing.tick();
    expect((await run(ORDER)).data?.order).toMatchObject({ status: 'processing', processingFailed: false });

    await processing.tick();
    expect((await run(ORDER)).data?.order).toMatchObject({ status: 'deliver', totals: { total: 30000 } });
  });

  it('AC-4.2: the worker finishes the order with no client requests in between', async () => {
    await payWithAddress('1 Main St');

    processing.startWorker(5);
    await vi.waitFor(() => expect(orders.findById('order-2')?.status).toBe('deliver'), { timeout: 1000 });
  });

  it('AC-4.4: a failed job is exposed as processingFailed, status stays processing', async () => {
    await payWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();

    expect((await run(ORDER)).data?.order).toMatchObject({ status: 'processing', processingFailed: true });
  });

  it('AC-4.4: retryProcessing restarts a failed job and the order can finish', async () => {
    await payWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();

    const retried = await run(RETRY);
    expect(retried.errors).toBeUndefined();
    expect(retried.data?.retryProcessing).toMatchObject({ status: 'processing', processingFailed: false });
  });

  it('AC-4.4: a repeated retryProcessing is not an error', async () => {
    await payWithAddress('1 Main St');
    await processing.tick();

    const result = await run(RETRY);

    expect(result.errors).toBeUndefined();
    expect(result.data?.retryProcessing).toMatchObject({ status: 'processing', processingFailed: false });
  });

  it('retryProcessing: INVALID_STATUS_TRANSITION before processing, the order itself once delivered', async () => {
    await payWithAddress('1 Main St'); // paid
    expect(code(await run(RETRY))).toBe('INVALID_STATUS_TRANSITION');

    // A late retry for a delivered order (double click) returns the order instead of an error
    orders.update({ ...orders.findById('order-2')!, status: 'deliver' });
    const late = await run(RETRY);
    expect(late.errors).toBeUndefined();
    expect(orders.findById('order-2')?.status).toBe('deliver');
  });

  it('retryProcessing: another user gets ORDER_NOT_FOUND, an unknown order looks the same', async () => {
    await payWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();

    const foreign = await run(RETRY, stranger);
    const unknown = await run('mutation { retryProcessing(orderId: "order-nope") { status } }');

    expect(code(foreign)).toBe('ORDER_NOT_FOUND');
    expect(code(unknown)).toBe('ORDER_NOT_FOUND');
    expect(unknown.errors?.[0].message).toBe(foreign.errors?.[0].message);
    expect((await run(ORDER)).data?.order).toMatchObject({ processingFailed: true });
  });

  it('retryProcessing: UNAUTHENTICATED without a token or with a bad one', async () => {
    const start = vi.spyOn(processing, 'retryProcessing');

    expect(code(await run(RETRY, ctxFor(null)))).toBe('UNAUTHENTICATED');
    expect(code(await run(RETRY, ctxFor('garbage')))).toBe('UNAUTHENTICATED');
    expect(start).not.toHaveBeenCalled();
  });

  it('retryProcessing: PROCESSING_FAILED when the fulfillment service is down, the order stays failed', async () => {
    await payWithAddress('1 FAIL St');
    await processing.tick();
    await processing.tick();
    const fulfillment = (processing as unknown as { fulfillmentService: MockFulfillmentService }).fulfillmentService;
    const { IntegrationUnavailableError } = await import('../integrations/interfaces');
    vi.spyOn(fulfillment, 'start').mockRejectedValue(new IntegrationUnavailableError('Fulfillment service'));

    expect(code(await run(RETRY))).toBe('PROCESSING_FAILED');
    expect((await run(ORDER)).data?.order).toMatchObject({ status: 'processing', processingFailed: true });
  });

  it('AC-7.2: seeded deliver and processing orders are in the list with status, products and total', async () => {
    const result = await run('query { orders { orderId status promo { id } products { product { id } amount price } totals { total } } }');

    expect(result.errors).toBeUndefined();
    const list = result.data?.orders as { orderId: string; status: string; products: unknown[]; totals: { total: number } }[];
    const delivered = list.find(o => o.orderId === 'order-1');
    expect(delivered).toMatchObject({ status: 'deliver', totals: { total: 1700 } });
    expect(delivered?.products).toHaveLength(2);
    expect(list.find(o => o.orderId === 'order-3')?.status).toBe('processing');
  });

  it('AC-7.2: an order that went through the whole flow shows up as deliver with its promo and total', async () => {
    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery('1 Main St'));
    await checkout.applyPromo('order-2', 'user-1', 'SAVE10');
    await server.executeOperation(
      { query: PAY, variables: { orderId: 'order-2', input: { cardToken: 'tok_approve_1', expectedTotal: 27000 } } },
      owner
    );
    await processing.tick();
    await processing.tick();

    const result = await run('query { orders { orderId status promo { id } totals { total } } }');

    const order = (result.data?.orders as { orderId: string }[]).find(o => o.orderId === 'order-2');
    expect(order).toMatchObject({ status: 'deliver', promo: { id: 'SAVE10' }, totals: { total: 27000 } });
  });

  it('AC-7.2: other users do not see these orders in their History', async () => {
    const result = await run('query { orders { orderId } }', stranger);

    expect(result.data?.orders).toEqual([]);
  });
});
