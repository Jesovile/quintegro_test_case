import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';

const ORDERS = `query { orders { orderId status products { amount price } totals { subtotal discount total currency } } }`;
const ORDER = `query Order($orderId: ID!) { order(orderId: $orderId) { orderId } }`;

const requestWith = (token?: string) => ({
  req: { headers: { authorization: token ? `Bearer ${token}` : undefined } } as unknown as Request
});

describe('orders over GraphQL', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let johnToken: string;
  let janeToken: string;

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    johnToken = (await container.authService.authenticateUser('john.doe', 'password123')) as string;
    janeToken = (await container.authService.authenticateUser('jane.smith', 'password456')) as string;
  });

  it('computes totals from the stored order', async () => {
    const result = await server.executeOperation({ query: ORDERS }, requestWith(johnToken));

    expect(result.errors).toBeUndefined();
    const order = (result.data?.orders as Array<{ orderId: string; totals: unknown }>).find(o => o.orderId === 'order-3');
    expect(order?.totals).toEqual({ subtotal: 2000, discount: 0, total: 2000, currency: 'USD' });
  });

  it('uses whole dollar prices and the new statuses in the seed', async () => {
    const result = await server.executeOperation({ query: ORDERS }, requestWith(johnToken));
    const orders = result.data?.orders as Array<{ status: string; products: Array<{ price: number }> }>;

    expect(orders.map(order => order.status).sort()).toEqual(['created', 'deliver', 'processing']);
    expect(orders.flatMap(order => order.products).every(item => Number.isInteger(item.price))).toBe(true);
  });

  it('rejects the removed client-priced operations', async () => {
    const orderSum = await server.executeOperation(
      { query: `query { orderSum(orderId: "order-2", products: []) }` },
      requestWith(johnToken)
    );
    const submit = await server.executeOperation(
      { query: `mutation { submitOrder(orderId: "order-2") }` },
      requestWith(johnToken)
    );

    expect(orderSum.errors?.[0].extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
    expect(submit.errors?.[0].extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('returns UNAUTHENTICATED without a token', async () => {
    const result = await server.executeOperation({ query: ORDERS }, requestWith());

    expect(result.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('does not distinguish a foreign order from a missing one', async () => {
    const foreign = await server.executeOperation({ query: ORDER, variables: { orderId: 'order-2' } }, requestWith(janeToken));
    const missing = await server.executeOperation({ query: ORDER, variables: { orderId: 'nope' } }, requestWith(janeToken));

    expect(foreign.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
    expect(missing.errors?.[0].message).toBe(foreign.errors?.[0].message);
  });

  it('hides details of unexpected errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(container.orderService, 'getOrdersByUserId').mockRejectedValue(new Error('secret detail'));

    const result = await server.executeOperation({ query: ORDERS }, requestWith(johnToken));

    expect(result.errors?.[0].extensions?.code).toBe('INTERNAL');
    expect(result.errors?.[0].message).toBe('Internal server error');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret detail');
    consoleError.mockRestore();
  });
});
