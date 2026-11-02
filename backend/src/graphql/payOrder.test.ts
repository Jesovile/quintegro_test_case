import { ProcessingService } from '../services/processingService';
import { CancellationService } from '../services/cancellationService';
import { MockFulfillmentService } from '../integrations/mock/mockFulfillmentService';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { createContainer } from '../container';
import { createApolloServer } from './server';
import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository
} from '../repositories/implementations';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { MockBankGateway } from '../integrations/mock/mockBankGateway';
import { IntegrationUnavailableError } from '../integrations/interfaces';
import { OrderService } from '../services/orderService';
import { PromoService } from '../services/promoService';
import { CheckoutService } from '../services/checkoutService';
import { PaymentService } from '../services/paymentService';

const PAY = `mutation Pay($orderId: ID!, $input: PayOrderInput!) {
  payOrder(orderId: $orderId, input: $input) { orderId status totals { total } }
}`;

const delivery = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

describe('payOrder over GraphQL', () => {
  // Only the auth service is taken from the container; payment wiring uses short timeouts and no delays
  const { authService } = createContainer();
  let orders: InMemoryOrderRepository;
  let bank: MockBankGateway;
  let server: ReturnType<typeof createApolloServer>;
  let checkout: CheckoutService;
  let owner: { req: Request };
  let stranger: { req: Request };

  const ctxFor = (token: string | null | undefined) => ({
    req: { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request
  });

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders = new InMemoryOrderRepository();
    const geo = new MockGeoService(0);
    bank = new MockBankGateway(0);
    const orderService = new OrderService(orders, new InMemoryProductRepository());
    const promoService = new PromoService(new InMemoryPromoRepository());
    const paymentService = new PaymentService(orders, orderService, geo, bank, { geoMs: 50, bankMs: 50 });
    checkout = new CheckoutService(orders, orderService, geo, promoService, paymentService);
    const fulfillment = new MockFulfillmentService(geo, 0, 0);
    const processingService = new ProcessingService(orders, orderService, fulfillment);
    const cancellationService = new CancellationService(orders, orderService, paymentService, bank, fulfillment, 50);
    server = createApolloServer({ orderService, checkoutService: checkout, paymentService, processingService, cancellationService, promoService, authService });
    owner = ctxFor(await authService.authenticateUser('john.doe', 'password123'));
    stranger = ctxFor(await authService.authenticateUser('jane.smith', 'password456'));

    await checkout.startCheckout('order-2', 'user-1');
    await checkout.saveDelivery('order-2', 'user-1', delivery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const pay = (cardToken: string, expectedTotal = 30000, context = owner, orderId = 'order-2') =>
    server.executeOperation({ query: PAY, variables: { orderId, input: { cardToken, expectedTotal } } }, context);
  const code = (result: Awaited<ReturnType<typeof pay>>) => result.errors?.[0].extensions?.code;
  const mutationCode = async (query: string) =>
    (await server.executeOperation({ query }, owner)).errors?.[0].extensions?.code;

  it('AC-3.2: an approved card returns the order in paid', async () => {
    const result = await pay('tok_approve_1');

    expect(result.errors).toBeUndefined();
    expect(result.data?.payOrder).toMatchObject({ orderId: 'order-2', status: 'paid', totals: { total: 30000 } });
  });

  it('AC-3.3: PAYMENT_DECLINED in extensions.code, order stays in checkout, retry with another card works', async () => {
    const declined = await pay('tok_decline_1');

    expect(code(declined)).toBe('PAYMENT_DECLINED');
    expect(JSON.stringify(declined.errors)).not.toContain('Card declined');
    expect(orders.findById('order-2')?.status).toBe('checkout');
    expect((await pay('tok_approve_2')).data?.payOrder).toMatchObject({ status: 'paid' });
  });

  it('AC-3.4: PAYMENT_UNCONFIRMED after a lost answer, the next attempt does not charge again', async () => {
    expect(code(await pay('tok_timeout_1'))).toBe('PAYMENT_UNCONFIRMED');
    const charge = vi.spyOn(bank, 'charge');

    const retry = await pay('tok_approve_1');

    expect(retry.data?.payOrder).toMatchObject({ status: 'paid' });
    expect(charge).not.toHaveBeenCalled();
  });

  it('PAYMENT_UNAVAILABLE when the bank cannot confirm an unresolved earlier attempt', async () => {
    expect(code(await pay('tok_timeout_1'))).toBe('PAYMENT_UNCONFIRMED');
    vi.spyOn(bank, 'getPaymentByKey').mockRejectedValue(new IntegrationUnavailableError('Bank'));
    const charge = vi.spyOn(bank, 'charge');

    expect(code(await pay('tok_approve_1'))).toBe('PAYMENT_UNAVAILABLE');
    expect(charge).not.toHaveBeenCalled();
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('AC-3.6: a repeated payOrder returns success and the same order without a second charge', async () => {
    const first = await pay('tok_approve_1');
    const charge = vi.spyOn(bank, 'charge');

    const second = await pay('tok_approve_1');

    expect(second.errors).toBeUndefined();
    expect(second.data?.payOrder).toEqual(first.data?.payOrder);
    expect(charge).not.toHaveBeenCalled();
  });

  it('AC-3.7: TOTAL_CHANGED, no charge, order stays in checkout', async () => {
    const charge = vi.spyOn(bank, 'charge');

    const result = await pay('tok_approve_1', 12345);

    expect(code(result)).toBe('TOTAL_CHANGED');
    expect(charge).not.toHaveBeenCalled();
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('DELIVERY_REQUIRED when delivery data is missing', async () => {
    const order = orders.findById('order-2')!;
    orders.update({ ...order, contact: undefined, addressRef: undefined });

    expect(code(await pay('tok_approve_1'))).toBe('DELIVERY_REQUIRED');
  });

  it('INVALID_STATUS_TRANSITION for an order outside checkout', async () => {
    await checkout.exitCheckout('order-2', 'user-1');

    expect(code(await pay('tok_approve_1'))).toBe('INVALID_STATUS_TRANSITION');
  });

  it('AC-6.4: another user gets ORDER_NOT_FOUND and nothing is charged', async () => {
    const charge = vi.spyOn(bank, 'charge');

    const result = await pay('tok_approve_1', 30000, stranger);

    expect(code(result)).toBe('ORDER_NOT_FOUND');
    expect(charge).not.toHaveBeenCalled();
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('AC-6.4: an unknown order looks the same as a foreign one', async () => {
    const foreign = await pay('tok_approve_1', 30000, stranger);
    const unknown = await pay('tok_approve_1', 30000, owner, 'order-nope');

    expect(code(unknown)).toBe('ORDER_NOT_FOUND');
    expect(unknown.errors?.[0].message).toBe(foreign.errors?.[0].message);
  });

  it('UNAUTHENTICATED without a token and with a bad token, nothing is charged', async () => {
    const charge = vi.spyOn(bank, 'charge');

    expect(code(await pay('tok_approve_1', 30000, ctxFor(null)))).toBe('UNAUTHENTICATED');
    expect(code(await pay('tok_approve_1', 30000, ctxFor('garbage')))).toBe('UNAUTHENTICATED');
    expect(charge).not.toHaveBeenCalled();
  });

  it('the API has no field for card data', async () => {
    const result = await server.executeOperation(
      {
        query: PAY,
        variables: { orderId: 'order-2', input: { cardToken: 'tok_approve_1', expectedTotal: 30000, cardNumber: '4242424242424242' } }
      },
      owner
    );

    expect(result.errors).toBeDefined();
    expect(orders.findById('order-2')?.status).toBe('checkout');
  });

  it('the Order type does not expose payment details', async () => {
    const result = await server.executeOperation(
      { query: 'query { order(orderId: "order-2") { payment { paymentId } } }' },
      owner
    );

    expect(result.errors).toBeDefined();
  });

  it('AC-1.7: after payment the order cannot return to the Delivery or Payment steps', async () => {
    await pay('tok_approve_1');

    expect(await mutationCode('mutation { exitCheckout(orderId: "order-2") { status } }')).toBe('INVALID_STATUS_TRANSITION');
    expect(await mutationCode('mutation { startCheckout(orderId: "order-2") { status } }')).toBe('INVALID_STATUS_TRANSITION');
    expect(await mutationCode('mutation { applyPromo(orderId: "order-2", code: "SAVE10") { status } }')).toBe('ORDER_NOT_EDITABLE');
    expect(await mutationCode('mutation { removePromo(orderId: "order-2") { status } }')).toBe('ORDER_NOT_EDITABLE');
    expect(
      await mutationCode(`mutation { saveDelivery(orderId: "order-2", input: {
        fullName: "John Doe", email: "john@example.com", phone: "5551234567",
        address: { line1: "2 Other St", city: "Springfield", state: "IL", zip: "62701" } }) { status } }`)
    ).toBe('ORDER_NOT_EDITABLE');
    expect(orders.findById('order-2')?.status).toBe('paid');
  });

  it('AC-1.7: the same holds for processing and deliver', async () => {
    for (const status of ['processing', 'deliver'] as const) {
      orders.update({ ...orders.findById('order-2')!, status });

      expect(await mutationCode('mutation { exitCheckout(orderId: "order-2") { status } }')).toBe('INVALID_STATUS_TRANSITION');
      expect(await mutationCode('mutation { startCheckout(orderId: "order-2") { status } }')).toBe('INVALID_STATUS_TRANSITION');
      expect(orders.findById('order-2')?.status).toBe(status);
    }
  });

  it('does not log card tokens or personal data', async () => {
    const spies = (['log', 'error', 'warn', 'info'] as const).map(m =>
      vi.spyOn(console, m).mockImplementation(() => undefined)
    );

    await pay('tok_decline_secret');
    await pay('tok_timeout_secret');
    await pay('tok_approve_secret', 1);

    const logged = JSON.stringify(spies.map(s => s.mock.calls));
    for (const value of ['tok_', 'John Doe', 'john@example.com', '5551234567', 'Main St']) {
      expect(logged).not.toContain(value);
    }
  });
});
