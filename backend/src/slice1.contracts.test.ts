import { describe, expect, it } from 'vitest';
import { GraphQLError } from 'graphql';
import { Request } from 'express';
import { createContainer } from './container';
import { createApolloServer } from './graphql/server';
import { formatGraphQLError } from './graphql/errors';
import { DomainError } from './errors/domainError';
import { calculateOrderTotals } from './services/pricing';
import { InMemoryOrderRepository } from './repositories/implementations';

const requestWith = (token: string) => ({
  req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request
});

describe('AC-6.3 totals are computed from the server order', () => {
  it('seed order totals match stored prices and amounts', async () => {
    const { orderService } = createContainer();
    const orders = await orderService.getOrdersByUserId('user-1');
    const byId = Object.fromEntries(orders.map(o => [o.orderId, o.totals]));

    // order-2: 40 positions, 10 of each price 1300 / 900 / 200 / 600
    expect(byId['order-2']).toEqual({ subtotal: 30000, discount: 0, total: 30000, currency: 'USD' });
    expect(byId['order-1'].total).toBe(1700);
    expect(byId['order-3'].total).toBe(2000);
  });

  it('seed prices are the rounded-up whole dollars from the requirements', () => {
    const { orderRepository } = createContainer();
    const prices = new Set(orderRepository.findById('order-2')?.products.map(p => p.price));

    expect([...prices].sort((a, b) => a - b)).toEqual([200, 600, 900, 1300]);
  });

  it('totals follow a change of the stored amount, not any client value', async () => {
    const { orderService, orderRepository } = createContainer();
    const order = orderRepository.findById('order-3');
    if (!order) throw new Error('seed order missing');
    orderRepository.update({ ...order, products: order.products.map(p => ({ ...p, amount: 1 })) });

    const dto = await orderService.getOrderById('order-3', 'user-1');

    expect(dto?.totals.total).toBe(900 + 200);
  });

  it('applies a stored promo discount to the total with half-up rounding', () => {
    expect(calculateOrderTotals([{ amount: 1, price: 1300 }], 10)).toEqual({
      subtotal: 1300, discount: 130, total: 1170, currency: 'USD'
    });
    expect(calculateOrderTotals([{ amount: 1, price: 5 }], 10).discount).toBe(1);
    expect(calculateOrderTotals([{ amount: 1, price: 4 }], 10).discount).toBe(0);
  });

  it('exposes only integer money fields in GraphQL totals for every order', async () => {
    const container = createContainer();
    const server = createApolloServer(container);
    const token = (await container.authService.authenticateUser('john.doe', 'password123')) as string;

    const result = await server.executeOperation(
      { query: `query { orders { totals { subtotal discount total } } }` },
      requestWith(token)
    );
    const totals = (result.data?.orders as Array<{ totals: Record<string, number> }>).flatMap(o => Object.values(o.totals));

    expect(totals.length).toBeGreaterThan(0);
    expect(totals.every(Number.isInteger)).toBe(true);
  });

  it('GraphQL schema has integer prices and totals and no client-priced inputs', async () => {
    const container = createContainer();
    const server = createApolloServer(container);
    const token = (await container.authService.authenticateUser('john.doe', 'password123')) as string;

    const result = await server.executeOperation(
      { query: `query { a: __type(name: "OrderItem") { fields { name type { ofType { name } } } } b: __type(name: "OrderTotals") { fields { type { ofType { name } } } } }` },
      requestWith(token)
    );
    const item = (result.data?.a as { fields: Array<{ name: string; type: { ofType: { name: string } } }> }).fields;
    const totals = (result.data?.b as { fields: Array<{ type: { ofType: { name: string } } }> }).fields;

    expect(item.find(f => f.name === 'price')?.type.ofType.name).toBe('Int');
    expect(totals.filter(f => f.type.ofType.name === 'Int')).toHaveLength(3);
  });
});

describe('statuses', () => {
  it('GraphQL OrderStatus enum has exactly the six new statuses', async () => {
    const container = createContainer();
    const server = createApolloServer(container);
    const token = (await container.authService.authenticateUser('john.doe', 'password123')) as string;

    const result = await server.executeOperation(
      { query: `query { __type(name: "OrderStatus") { enumValues { name } } }` },
      requestWith(token)
    );
    const names = (result.data?.__type as { enumValues: Array<{ name: string }> }).enumValues.map(v => v.name);

    expect(names).toEqual(['created', 'checkout', 'paid', 'processing', 'deliver', 'cancelled']);
    expect(names).not.toContain('submited');
    expect(names).not.toContain('finished');
  });

  it('seed maps old submited -> processing and finished -> deliver', () => {
    const { orderRepository } = createContainer();

    expect(orderRepository.findById('order-1')?.status).toBe('deliver');
    expect(orderRepository.findById('order-3')?.status).toBe('processing');
  });
});

describe('removed operations', () => {
  it('OrderService no longer has submitOrder / calculateOrderSum', () => {
    const { orderService } = createContainer();
    const service = orderService as unknown as Record<string, unknown>;

    expect(service.submitOrder).toBeUndefined();
    expect(service.calculateOrderSum).toBeUndefined();
  });
});

describe('extensions.code mapping', () => {
  it.each(['UNAUTHENTICATED', 'ORDER_NOT_FOUND', 'PROMO_NOT_FOUND', 'PROMO_EXPIRED', 'INTERNAL'] as const)(
    'passes DomainError code %s through',
    code => {
      const original = new DomainError(code, 'msg');
      const formatted = formatGraphQLError(new GraphQLError('msg', { originalError: original }));

      expect(formatted.extensions?.code).toBe(code);
      expect(formatted.message).toBe('msg');
    }
  );

  it('keeps Apollo validation codes and maps unknown errors to INTERNAL without the message', () => {
    const validation = formatGraphQLError(new GraphQLError('bad', { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }));
    expect(validation.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');

    const unknown = formatGraphQLError(new GraphQLError('db password leaked', { originalError: new Error('db password leaked') }));
    expect(unknown.extensions?.code).toBe('INTERNAL');
    expect(unknown.message).not.toContain('leaked');
  });

  it('login with wrong credentials gives UNAUTHENTICATED; unknown/expired promos give their codes', async () => {
    const container = createContainer();
    const server = createApolloServer(container);
    const ctx = { req: { headers: {} } as unknown as Request };

    const login = await server.executeOperation(
      { query: `mutation { login(input: {login: "x", password: "y"}) { token } }` }, ctx);
    const unknown = await server.executeOperation({ query: `query { promo(promoId: "NOPE") { id } }` }, ctx);
    const expired = await server.executeOperation({ query: `query { promo(promoId: "SAVE5") { id } }` }, ctx);
    const valid = await server.executeOperation({ query: `query { promo(promoId: "SAVE10") { id discount } }` }, ctx);

    expect(login.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    expect(unknown.errors?.[0].extensions?.code).toBe('PROMO_NOT_FOUND');
    expect(expired.errors?.[0].extensions?.code).toBe('PROMO_EXPIRED');
    expect(valid.data?.promo).toEqual({ id: 'SAVE10', discount: 10 });
  });

  it('an invalid token gives UNAUTHENTICATED', async () => {
    const container = createContainer();
    const server = createApolloServer(container);

    const result = await server.executeOperation(
      { query: `query { orders { orderId } }` }, requestWith('garbage'));

    expect(result.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
  });
});

describe('single store', () => {
  it('container hands the same repository to the order service and exposes it for /reset/orders', async () => {
    const container = createContainer();
    expect(container.orderRepository).toBeInstanceOf(InMemoryOrderRepository);

    await container.orderService.deleteProductFromOrder('order-2', 'product-1', 'user-1');
    expect(container.orderRepository.findById('order-2')?.products.some(p => p.id === 'product-1')).toBe(false);

    container.orderRepository.reset();
    const dto = await container.orderService.getOrderById('order-2', 'user-1');
    expect(dto?.products.some(p => p.product.id === 'product-1')).toBe(true);
  });

  it('separate containers do not share state', async () => {
    const a = createContainer();
    const b = createContainer();
    await a.orderService.deleteProductFromOrder('order-2', 'product-1', 'user-1');

    expect(b.orderRepository.findById('order-2')?.products.some(p => p.id === 'product-1')).toBe(true);
  });
});
