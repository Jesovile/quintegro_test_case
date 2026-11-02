import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';

vi.mock('./middleware/delayMiddleware', () => ({
  delayMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));
vi.mock('./middleware/errorTestMiddleware', () => ({
  errorTestMiddleware: (_req: unknown, _res: unknown, next: () => void) => next()
}));

import { App } from './app';

describe('REST promo and order discount (AC-3.8, AC-3.9)', () => {
  let server: http.Server;
  let base: string;
  let token: string;

  const post = (path: string, body: unknown, auth?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body)
    });
  const gql = async (query: string) =>
    (await post('/graphql', { query }, token)).json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;

  beforeAll(async () => {
    const app = new App();
    server = http.createServer(app.app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await new Promise(resolve => setTimeout(resolve, 300));
    const login = await post('/api/login', { login: 'john.doe', password: 'password123' });
    token = ((await login.json()) as { token: string }).token;
  });

  afterAll(() => new Promise<void>(resolve => { server.close(() => resolve()); }));

  it('GET /api/promo/:id returns an active promo (AC-3.8)', async () => {
    const res = await fetch(`${base}/api/promo/SAVE10`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'SAVE10', discount: 10 });
  });

  it('GET /api/promo/:id answers 404 for an unknown code (AC-3.9)', async () => {
    expect((await fetch(`${base}/api/promo/NOPE`)).status).toBe(404);
    expect((await fetch(`${base}/api/promo/save10`)).status).toBe(404);
  });

  it('GET /api/promo/:id answers 401 for an expired code (AC-3.9)', async () => {
    const res = await fetch(`${base}/api/promo/SAVE5`);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Promo expired' });
  });

  it('applying the same code twice is idempotent (AC-3.8)', async () => {
    await gql('mutation { startCheckout(orderId: "order-2") { status } }');
    const q = 'mutation { applyPromo(orderId: "order-2", code: "SAVE10") { promo { id } totals { discount total } } }';
    const first = await gql(q);
    const second = await gql(q);

    expect(second.errors).toBeUndefined();
    expect(second.data).toEqual(first.data);
    expect((second.data?.applyPromo as { totals: { discount: number } }).totals.discount).toBe(3000);
  });

  it('the discount is visible in the REST order response (AC-3.8)', async () => {
    const res = await fetch(`${base}/api/order/order-2`, { headers: { authorization: `Bearer ${token}` } });
    const body = (await res.json()) as { promo?: { id: string }; totals: { subtotal: number; discount: number; total: number } };

    expect(res.status).toBe(200);
    expect(body.promo?.id).toBe('SAVE10');
    expect(body.totals).toMatchObject({ subtotal: 30000, discount: 3000, total: 27000 });
  });

  it('removePromo removes it and is safe to repeat without a promo (AC-3.8)', async () => {
    const q = 'mutation { removePromo(orderId: "order-2") { promo { id } totals { discount total } } }';
    const first = await gql(q);
    const again = await gql(q);

    expect(first.errors).toBeUndefined();
    expect(again.errors).toBeUndefined();
    expect(again.data?.removePromo).toEqual({ promo: null, totals: { discount: 0, total: 30000 } });
  });

  it('a rejected code does not change the REST total (AC-3.9)', async () => {
    const res = await gql('mutation { applyPromo(orderId: "order-2", code: "SAVE5") { totals { total } } }');
    const rest = await fetch(`${base}/api/order/order-2`, { headers: { authorization: `Bearer ${token}` } });
    const body = (await rest.json()) as { totals: { discount: number; total: number } };

    expect(res.errors).toBeDefined();
    expect(body.totals).toMatchObject({ discount: 0, total: 30000 });
  });
});
