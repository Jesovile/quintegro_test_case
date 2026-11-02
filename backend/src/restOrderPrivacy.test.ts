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

describe('REST does not expose checkout personal data (AC-2.2)', () => {
  let server: http.Server;
  let base: string;
  let token: string;

  const post = (path: string, body: unknown, auth?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body)
    });

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

  it('GET /api/order/:id and the list have no contact, addressRef or delivery', async () => {
    const gql = async (query: string) =>
      (await post('/graphql', { query }, token)).json() as Promise<{ errors?: unknown[] }>;
    expect((await gql('mutation { startCheckout(orderId: "order-2") { status } }')).errors).toBeUndefined();
    const saved = await gql(`mutation { saveDelivery(orderId: "order-2", input: {
      fullName: "John Doe", email: "john@example.com", phone: "5551234567",
      address: { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701" } }) { status } }`);
    expect(saved.errors).toBeUndefined();

    const headers = { authorization: `Bearer ${token}` };
    const single = await fetch(`${base}/api/order/order-2`, { headers });
    const list = await fetch(`${base}/api/order`, { headers });
    const text = (await single.text()) + (await list.text());

    expect(single.status).toBe(200);
    for (const forbidden of ['contact', 'addressRef', '"delivery"', 'john@example.com', 'John Doe', '5551234567', 'Main St', 'addr_']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
