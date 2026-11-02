import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';

// Intentional slowdowns of the demo middleware are not part of what is tested here
vi.mock('./middleware/delayMiddleware', () => ({
  delayMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));
vi.mock('./middleware/errorTestMiddleware', () => ({
  errorTestMiddleware: (_req: unknown, _res: unknown, next: () => void) => next()
}));

import { App } from './app';

const ORDERS = `query { orders { orderId status products { product { id } } totals { total } } }`;

describe('App: REST and GraphQL share one store (Slice 1)', () => {
  let server: http.Server;
  let base: string;
  let token: string;

  const gql = async (query: string) => {
    const response = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query })
    });
    return response.json() as Promise<{ data?: { orders: Array<{ orderId: string; products: Array<{ product: { id: string } }>; totals: { total: number } }> } }>;
  };
  const rest = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

  beforeAll(async () => {
    const app = new App();
    server = http.createServer(app.app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // GraphQL middleware is attached asynchronously in the constructor
    await new Promise(resolve => setTimeout(resolve, 300));

    const login = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'john.doe', password: 'password123' })
    });
    token = ((await login.json()) as { token: string }).token;
  });

  afterAll(() => new Promise<void>(resolve => { server.close(() => resolve()); }));

  it('REST deletion is visible over GraphQL and /reset/orders restores both', async () => {
    const before = await gql(ORDERS);
    const order2 = before.data?.orders.find(o => o.orderId === 'order-2');
    expect(order2?.products.some(p => p.product.id === 'product-1')).toBe(true);

    const deleted = await rest('/api/order/order-2/product-1', 'DELETE');
    expect(deleted.status).toBe(200);

    const after = await gql(ORDERS);
    const changed = after.data?.orders.find(o => o.orderId === 'order-2');
    expect(changed?.products.some(p => p.product.id === 'product-1')).toBe(false);
    expect(changed?.totals.total).toBe((order2?.totals.total ?? 0) - 1300);

    const reset = await fetch(`${base}/reset/orders`);
    expect(reset.status).toBe(200);

    const restored = await gql(ORDERS);
    const again = restored.data?.orders.find(o => o.orderId === 'order-2');
    expect(again?.products.some(p => p.product.id === 'product-1')).toBe(true);
    const restBody = (await (await rest('/api/order/order-2')).json()) as { products: unknown[] };
    expect(restBody.products).toHaveLength(40);
  });

  it('REST orders expose whole-dollar prices', async () => {
    const orders = (await (await rest('/api/order')).json()) as Array<{ status: string; products: Array<{ price: number }> }>;

    expect(orders.flatMap(o => o.products).every(p => Number.isInteger(p.price))).toBe(true);
    expect(orders.map(o => o.status).sort()).toEqual(['created', 'deliver', 'processing']);
  });

  it('has removed POST /api/order/:orderId (submit)', async () => {
    const response = await rest('/api/order/order-2', 'POST', {});

    expect(response.status).toBe(404);
  });

  it('has removed POST /api/order/:orderId/sum', async () => {
    const response = await rest('/api/order/order-2/sum', 'POST', { products: [{ id: 'product-1', amount: 1, price: 1 }] });

    expect(response.status).toBe(404);
  });

  it('keeps order-2 in status created after the removed submit call', async () => {
    await rest('/api/order/order-2', 'POST', {});
    const order = (await (await rest('/api/order/order-2')).json()) as { status: string };

    expect(order.status).toBe('created');
  });

  describe('checkout status over REST (AC-1.1, AC-1.6, AC-6.1, AC-6.4)', () => {
    afterEach(async () => {
      await fetch(`${base}/reset/orders`);
    });

    const mutate = async (query: string) => {
      const response = await fetch(`${base}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query })
      });
      return response.json() as Promise<{ data?: { startCheckout?: { status: string } }; errors?: unknown[] }>;
    };
    const START = `mutation { startCheckout(orderId: "order-2") { status } }`;
    const EXIT = `mutation { exitCheckout(orderId: "order-2") { status } }`;

    it('AC-1.1: a checkout started over GraphQL is visible as checkout over REST', async () => {
      const started = await mutate(START);
      expect(started.data?.startCheckout?.status).toBe('checkout');

      const order = (await (await rest('/api/order/order-2')).json()) as { status: string };
      expect(order.status).toBe('checkout');
      const list = (await (await rest('/api/order')).json()) as Array<{ orderId: string; status: string }>;
      expect(list.find(o => o.orderId === 'order-2')?.status).toBe('checkout');
    });

    it('AC-6.1: REST DELETE is refused with 409 in checkout and the order is unchanged', async () => {
      await mutate(START);

      const response = await rest('/api/order/order-2/product-1', 'DELETE');

      expect(response.status).toBe(409);
      const order = (await (await rest('/api/order/order-2')).json()) as { status: string; products: unknown[] };
      expect(order.status).toBe('checkout');
      expect(order.products).toHaveLength(40);
    });

    it('AC-1.6: after exitCheckout REST deletion works again', async () => {
      await mutate(START);
      await mutate(EXIT);

      const response = await rest('/api/order/order-2/product-1', 'DELETE');

      expect(response.status).toBe(200);
    });

    it('AC-6.4: requests without a token are refused', async () => {
      const unauthenticated = await fetch(`${base}/api/order/order-2`);
      // The spec requires a refusal without data, not a specific status code
      expect([401, 403]).toContain(unauthenticated.status);
      expect(await unauthenticated.text()).not.toContain('order-2');

      const gqlResponse = await fetch(`${base}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: START })
      });
      const body = (await gqlResponse.json()) as { errors?: Array<{ extensions?: { code?: string } }> };
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('REST DELETE product (AC-6.1, AC-6.2)', () => {
    afterEach(async () => {
      await fetch(`${base}/reset/orders`);
    });

    it.each(['order-1', 'order-3'])('AC-6.1: answers 409 and keeps %s unchanged', async (orderId) => {
      const before = (await (await rest(`/api/order/${orderId}`)).json()) as { status: string; products: Array<{ product: { id: string } }> };
      expect(before.status).not.toBe('created');

      const response = await rest(`/api/order/${orderId}/${before.products[0].product.id}`, 'DELETE');

      expect(response.status).toBe(409);
      const after = (await (await rest(`/api/order/${orderId}`)).json()) as { products: unknown[] };
      expect(after.products).toHaveLength(before.products.length);
    });

    it('AC-6.2: removing the last position returns 200 with an empty order', async () => {
      const order = (await (await rest('/api/order/order-2')).json()) as { products: Array<{ product: { id: string } }> };
      let last: Response | undefined;
      for (const product of order.products) {
        last = await rest(`/api/order/order-2/${product.product.id}`, 'DELETE');
        expect(last.status).toBe(200);
      }

      const body = (await last!.json()) as { products: unknown[] };
      expect(body.products).toEqual([]);
      const reread = (await (await rest('/api/order/order-2')).json()) as { products: unknown[] };
      expect(reread.products).toEqual([]);
    });
  });
});
