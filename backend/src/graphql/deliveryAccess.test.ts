import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';

const input = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

type Ctx = { req: Request };
const ctxFor = (token: string | null | undefined): Ctx => ({
  req: { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request
});

describe('delivery access (AC-2.2, owner checks, PII)', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let owner: Ctx;
  let stranger: Ctx;

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    owner = ctxFor(await container.authService.authenticateUser('john.doe', 'password123'));
    stranger = ctxFor(await container.authService.authenticateUser('jane.smith', 'password456'));
    await server.executeOperation({ query: 'mutation { startCheckout(orderId: "order-2") { status } }' }, owner);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const save = (context: Ctx) =>
    server.executeOperation(
      { query: 'mutation S($i: DeliveryInput!) { saveDelivery(orderId: "order-2", input: $i) { status } }', variables: { i: input } },
      context
    );

  it('a stranger cannot call saveDelivery on a foreign order and nothing is saved', async () => {
    const result = await save(stranger);

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
    expect(container.orderRepository.findById('order-2')?.contact).toBeUndefined();
    expect(container.orderRepository.findById('order-2')?.addressRef).toBeUndefined();
  });

  it('a stranger does not see delivery of the order', async () => {
    await save(owner);
    const result = await server.executeOperation(
      { query: '{ order(orderId: "order-2") { delivery { email phone } } }' },
      stranger
    );

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
    expect(result.data?.order ?? null).toBeNull();
    expect(JSON.stringify(result)).not.toContain('john@example.com');
  });

  it('a foreign order is indistinguishable from a missing one', async () => {
    const missing = await server.executeOperation({ query: '{ order(orderId: "nope") { orderId } }' }, stranger);
    const foreign = await server.executeOperation({ query: '{ order(orderId: "order-2") { orderId } }' }, stranger);

    expect(foreign.errors?.[0].extensions?.code).toBe(missing.errors?.[0].extensions?.code);
    expect(foreign.errors?.[0].message).toBe(missing.errors?.[0].message);
  });

  it('rejects saveDelivery without a token', async () => {
    const result = await save(ctxFor(null));

    expect(result.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('returns the delivery to its owner', async () => {
    await save(owner);
    const result = await server.executeOperation(
      { query: '{ order(orderId: "order-2") { delivery { email } } }' },
      owner
    );

    expect(result.data?.order).toEqual({ delivery: { email: 'john@example.com' } });
  });

  it('does not log personal data across owner, stranger, read and exit', async () => {
    const spies = (['log', 'error', 'warn', 'info'] as const).map(m => vi.spyOn(console, m).mockImplementation(() => undefined));

    await save(stranger);
    await save(owner);
    await server.executeOperation({ query: '{ order(orderId: "order-2") { delivery { email } } }' }, owner);
    await server.executeOperation({ query: 'mutation { exitCheckout(orderId: "order-2") { status } }' }, owner);

    const logged = JSON.stringify(spies.map(s => s.mock.calls));
    for (const value of ['John Doe', 'john@example.com', '5551234567', 'Main St', 'Springfield']) {
      expect(logged).not.toContain(value);
    }
  });
});
