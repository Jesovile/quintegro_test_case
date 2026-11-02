import { beforeEach, describe, expect, it } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';
import { canTransition } from '../services/orderStateMachine';

const START = `mutation Start($orderId: ID!) { startCheckout(orderId: $orderId) { orderId status } }`;
const EXIT = `mutation Exit($orderId: ID!) { exitCheckout(orderId: $orderId) { orderId status } }`;
const UPDATE_AMOUNT = `mutation Update($orderId: ID!) { updateProductAmount(orderId: $orderId, productId: "product-1", amount: 2) { orderId } }`;

const contextFor = (token?: string | null) => ({
  req: { headers: { authorization: token ? `Bearer ${token}` : undefined } } as unknown as Request
});

describe('entering and leaving checkout', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let john: { req: Request };

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    john = contextFor(await container.authService.authenticateUser('john.doe', 'password123'));
  });

  const run = (query: string, orderId: string, context = john) =>
    server.executeOperation({ query, variables: { orderId } }, context);

  it('moves a created order to checkout (AC-1.1)', async () => {
    const result = await run(START, 'order-2');

    expect(result.errors).toBeUndefined();
    expect(result.data?.startCheckout).toEqual({ orderId: 'order-2', status: 'checkout' });
    expect(container.orderRepository.findById('order-2')?.status).toBe('checkout');
  });

  it('is idempotent when the order is already in checkout', async () => {
    await run(START, 'order-2');
    const again = await run(START, 'order-2');

    expect(again.errors).toBeUndefined();
    expect((again.data?.startCheckout as { status: string }).status).toBe('checkout');
  });

  it('refuses to start checkout for an empty order (AC-1.2)', async () => {
    const order = container.orderRepository.findById('order-2')!;
    container.orderRepository.update({ ...order, products: [] });

    const result = await run(START, 'order-2');

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_EMPTY');
    expect(container.orderRepository.findById('order-2')?.status).toBe('created');
  });

  it('freezes the composition while in checkout', async () => {
    await run(START, 'order-2');
    const result = await run(UPDATE_AMOUNT, 'order-2');

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
  });

  it('returns the order to created on exit (AC-1.6)', async () => {
    await run(START, 'order-2');
    const result = await run(EXIT, 'order-2');

    expect(result.data?.exitCheckout).toEqual({ orderId: 'order-2', status: 'created' });
    expect((await run(UPDATE_AMOUNT, 'order-2')).errors).toBeUndefined();
  });

  it.each([['order-1', START], ['order-3', START], ['order-1', EXIT], ['order-3', EXIT]])(
    'rejects an invalid transition for %s',
    async (orderId, query) => {
      const before = container.orderRepository.findById(orderId)?.status;
      const result = await run(query, orderId);

      expect(result.errors?.[0].extensions?.code).toBe('INVALID_STATUS_TRANSITION');
      expect(container.orderRepository.findById(orderId)?.status).toBe(before);
    }
  );

  it('hides foreign orders and requires a token (AC-6.4)', async () => {
    const jane = contextFor(await container.authService.authenticateUser('jane.smith', 'password456'));

    const foreign = await run(START, 'order-2', jane);
    const anonymous = await run(START, 'order-2', contextFor());

    expect(foreign.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
    expect(anonymous.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    expect(container.orderRepository.findById('order-2')?.status).toBe('created');
  });
});

describe('checkout gaps (AC-1.3, AC-1.7, AC-7.1, concurrency)', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let john: { req: Request };

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    john = contextFor(await container.authService.authenticateUser('john.doe', 'password123'));
  });

  const run = (query: string, orderId: string) =>
    server.executeOperation({ query, variables: { orderId } }, john);

  it('AC-1.3: startCheckout returns the composition and the server total for the summary', async () => {
    const q = `mutation S($orderId: ID!) { startCheckout(orderId: $orderId) { status products { amount product { id } } totals { total } } }`;
    const result = await run(q, 'order-2');

    expect(result.errors).toBeUndefined();
    const data = result.data?.startCheckout as { products: unknown[]; totals: { total: number } };
    expect(data.products).toHaveLength(40);
    expect(Number.isInteger(data.totals.total)).toBe(true);
    expect(data.totals.total).toBeGreaterThan(0);
  });

  it('AC-7.1: an order in checkout stays in the orders list with status checkout', async () => {
    await run(START, 'order-2');
    const result = await server.executeOperation({ query: `query { orders { orderId status } }` }, john);

    const orders = result.data?.orders as Array<{ orderId: string; status: string }>;
    expect(orders.find(o => o.orderId === 'order-2')?.status).toBe('checkout');
  });

  it.each(['paid', 'processing'] as const)('AC-1.7: exitCheckout is rejected for a %s order', async (status) => {
    const order = container.orderRepository.findById('order-2')!;
    container.orderRepository.update({ ...order, status });

    const result = await run(EXIT, 'order-2');

    expect(result.errors?.[0].extensions?.code).toBe('INVALID_STATUS_TRANSITION');
    expect(container.orderRepository.findById('order-2')?.status).toBe(status);
  });

  it('concurrent startCheckout calls leave one consistent checkout state', async () => {
    const results = await Promise.all([run(START, 'order-2'), run(START, 'order-2'), run(START, 'order-2')]);

    for (const r of results) {
      expect(r.errors).toBeUndefined();
      expect((r.data?.startCheckout as { status: string }).status).toBe('checkout');
    }
    expect(container.orderRepository.findById('order-2')?.status).toBe('checkout');
  });

  it('concurrent startCheckout and exitCheckout produce no error other than a rejected transition', async () => {
    const results = await Promise.all([run(START, 'order-2'), run(EXIT, 'order-2')]);

    for (const r of results) {
      const code = r.errors?.[0].extensions?.code;
      expect(code === undefined || code === 'INVALID_STATUS_TRANSITION').toBe(true);
    }
    expect(['created', 'checkout']).toContain(container.orderRepository.findById('order-2')?.status);
  });

  it('concurrent exitCheckout calls on a checkout order end in created', async () => {
    await run(START, 'order-2');
    const results = await Promise.all([run(EXIT, 'order-2'), run(EXIT, 'order-2')]);

    for (const r of results) expect(r.errors).toBeUndefined();
    expect(container.orderRepository.findById('order-2')?.status).toBe('created');
  });
});

describe('order status machine', () => {
  it('allows only the designed transitions', () => {
    expect(canTransition('created', 'checkout')).toBe(true);
    expect(canTransition('checkout', 'created')).toBe(true);
    expect(canTransition('checkout', 'paid')).toBe(true);
    expect(canTransition('created', 'paid')).toBe(false);
    expect(canTransition('deliver', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'created')).toBe(false);
  });

  it('applies a repository transition only from the expected status', () => {
    const container = createContainer();

    expect(container.orderRepository.transition('order-3', ['created'], { status: 'checkout' })).toBeNull();
    expect(container.orderRepository.transition('order-2', ['created'], { status: 'checkout' })?.status).toBe('checkout');
    expect(container.orderRepository.transition('order-2', ['created'], { status: 'checkout' })).toBeNull();
  });
});
