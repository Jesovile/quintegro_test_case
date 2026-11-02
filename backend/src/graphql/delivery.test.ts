import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';
import { normalizeDelivery, validateDelivery } from '../services/checkoutValidation';

const SAVE = `mutation Save($orderId: ID!, $input: DeliveryInput!) {
  saveDelivery(orderId: $orderId, input: $input) { status deliverySaved }
}`;
const READ = `query Read($orderId: ID!) {
  order(orderId: $orderId) { deliverySaved delivery { fullName email phone address { line1 line2 city state zip } } }
  me { name }
}`;

const validInput = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+1 (555) 123-4567',
  address: { line1: '1 Main St', line2: 'Apt 2', city: 'Springfield', state: 'il', zip: '62701' }
};

describe('delivery step', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let context: { req: Request };

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    const token = await container.authService.authenticateUser('john.doe', 'password123');
    context = { req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request };
    await server.executeOperation({ query: `mutation { startCheckout(orderId: "order-2") { status } }` }, context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const save = (input: unknown, orderId = 'order-2') =>
    server.executeOperation({ query: SAVE, variables: { orderId, input } }, context);

  it('saves contact data and only a reference to the address (AC-2.2)', async () => {
    const result = await save(validInput);

    expect(result.errors).toBeUndefined();
    expect(result.data?.saveDelivery).toEqual({ status: 'checkout', deliverySaved: true });

    const record = container.orderRepository.findById('order-2');
    expect(record?.contact).toEqual({ fullName: 'John Doe', email: 'john@example.com', phone: '5551234567' });
    expect(record?.addressRef).toMatch(/^addr_/);
    expect(JSON.stringify(record)).not.toContain('Main St');
  });

  it('restores the saved delivery from the Geo service and prefills the name (AC-2.5)', async () => {
    const before = await server.executeOperation({ query: READ, variables: { orderId: 'order-2' } }, context);
    expect(before.data?.order).toEqual({ deliverySaved: false, delivery: null });
    expect(before.data?.me).toEqual({ name: 'John Doe' });

    await save(validInput);
    const after = await server.executeOperation({ query: READ, variables: { orderId: 'order-2' } }, context);

    expect((after.data?.order as { delivery: unknown }).delivery).toEqual({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '5551234567',
      address: { line1: '1 Main St', line2: 'Apt 2', city: 'Springfield', state: 'IL', zip: '62701' }
    });
  });

  it('returns field errors and saves nothing for invalid input (AC-2.1)', async () => {
    const result = await save({ ...validInput, email: 'nope', address: { ...validInput.address, zip: '12' } });

    expect(result.errors?.[0].extensions?.code).toBe('VALIDATION_FAILED');
    expect(result.errors?.[0].extensions?.fields).toEqual([
      { field: 'email', message: 'Enter a valid email address' },
      { field: 'address.zip', message: 'Enter a ZIP code like 12345 or 12345-6789' }
    ]);
    expect(container.orderRepository.findById('order-2')?.contact).toBeUndefined();
  });

  it('reports an address rejected by the Geo service (AC-2.3)', async () => {
    const result = await save({ ...validInput, address: { ...validInput.address, zip: '00000' } });

    expect(result.errors?.[0].extensions?.code).toBe('ADDRESS_REJECTED');
    expect(result.errors?.[0].extensions?.fields).toEqual([{ field: 'address.zip', message: 'We could not verify this ZIP code' }]);
  });

  it('reports an unavailable Geo service without saving (AC-2.4)', async () => {
    const result = await save({ ...validInput, address: { ...validInput.address, zip: '99999' } });

    expect(result.errors?.[0].extensions?.code).toBe('GEO_UNAVAILABLE');
    expect(container.orderRepository.findById('order-2')?.addressRef).toBeUndefined();
  });

  it('refuses delivery data outside checkout', async () => {
    const result = await save(validInput, 'order-3');

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
  });

  it('does not save when the order leaves checkout during the address check', async () => {
    const geoCheck = save(validInput);
    await server.executeOperation({ query: `mutation { exitCheckout(orderId: "order-2") { status } }` }, context);

    const result = await geoCheck;

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
    expect(container.orderRepository.findById('order-2')?.contact).toBeUndefined();
  });

  it('never logs personal data', async () => {
    const spies = (['log', 'error', 'warn', 'info'] as const).map(method =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );

    await save(validInput);
    await save({ ...validInput, email: 'nope' });
    await save({ ...validInput, address: { ...validInput.address, zip: '99999' } });

    const logged = JSON.stringify(spies.map(spy => spy.mock.calls));
    for (const value of ['John Doe', 'john@example.com', '555', 'Main St']) {
      expect(logged).not.toContain(value);
    }
  });
});

describe('delivery validation rules', () => {
  it('normalizes phone, state and blank apartment', () => {
    expect(normalizeDelivery({ ...validInput, address: { ...validInput.address, line2: '  ' } })).toEqual({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '5551234567',
      address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
    });
  });

  it('rejects unknown states and short names', () => {
    const fields = validateDelivery(normalizeDelivery({ ...validInput, fullName: 'J', address: { ...validInput.address, state: 'XX' } }))
      .map(error => error.field);

    expect(fields).toEqual(['fullName', 'address.state']);
  });
});
