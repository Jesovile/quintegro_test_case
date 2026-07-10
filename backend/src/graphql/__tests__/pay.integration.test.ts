import { describe, it, expect, beforeEach } from 'vitest';
import { ApolloServer } from 'apollo-server-express';
import { createApolloServer } from '../server';
import { OrderService } from '../../services/orderService';
import { AuthService } from '../../services/authService';
import { PromoService } from '../../services/promoService';
import { PaymentService } from '../../services/paymentService';
import {
  InMemoryUserRepository,
  InMemoryAuthRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  InMemoryDeliveryMethodRepository,
  InMemoryPaymentRepository
} from '../../repositories/implementations';

// Real Apollo server + real resolver/service stack (not unit-level mocks),
// exercised via ApolloServer.executeOperation — the AS3-recommended way to
// test resolvers end-to-end without spinning up an HTTP listener.
// See implementation-plan-04.md iteration 4.1.

const PAY_MUTATION = `
  mutation Pay($orderId: ID!, $idempotencyKey: String!, $card: CardInput!) {
    pay(orderId: $orderId, idempotencyKey: $idempotencyKey, card: $card) {
      order { orderId status }
      payment { paymentId status cardLast4 }
    }
  }
`;

const VALID_CARD = {
  cardNumber: '4242424242424242',
  expiry: '09/30',
  cvv: '123',
  cardholderName: 'Jane Doe'
};

describe('pay mutation (integration, real resolver/service stack)', () => {
  let server: ApolloServer;
  let userAToken: string;
  let userBToken: string;

  beforeEach(async () => {
    const userRepository = new InMemoryUserRepository();
    const authRepository = new InMemoryAuthRepository();
    const orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    const paymentRepository = new InMemoryPaymentRepository();

    const authService = new AuthService(authRepository, userRepository);
    const orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
    const promoService = new PromoService(promoRepository);
    const paymentService = new PaymentService(paymentRepository, orderRepository, orderService);

    server = createApolloServer(orderService, authService, promoService, deliveryMethodRepository, paymentService);

    // user-1 (john.doe) owns order-2 ('created'); user-2 (jane.smith) does not.
    userAToken = (await authService.authenticateUser('john.doe', 'password123'))!;
    userBToken = (await authService.authenticateUser('jane.smith', 'password456'))!;
  });

  function contextFor(token: string | null) {
    return {
      req: {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      }
    };
  }

  it('two sequential pay calls with the same idempotencyKey produce one PaymentRecord and identical responses', async () => {
    const variables = { orderId: 'order-2', idempotencyKey: 'same-key', card: VALID_CARD };

    const first = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(userAToken));
    const second = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(userAToken));

    expect(first.errors).toBeUndefined();
    expect(second.errors).toBeUndefined();
    expect((first.data as any).pay.payment.paymentId).toBe((second.data as any).pay.payment.paymentId);
    expect((first.data as any).pay).toEqual((second.data as any).pay);
  });

  it("a pay call with user A's idempotencyKey for user A's order, replayed with user B's JWT, throws 'Order not found or access denied'", async () => {
    const variables = { orderId: 'order-2', idempotencyKey: 'user-a-key', card: VALID_CARD };

    const first = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(userAToken));
    expect(first.errors).toBeUndefined();

    const replay = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(userBToken));
    expect(replay.errors).toBeDefined();
    expect(replay.errors![0].message).toBe('Order not found or access denied');
  });

  it('retrying after a declined-card failure with a fresh key succeeds, producing a second PaymentRecord, order ends up paid', async () => {
    const declineVariables = {
      orderId: 'order-2',
      idempotencyKey: 'decline-key',
      card: { ...VALID_CARD, cardNumber: '4000000000000002' }
    };
    const declineResult = await server.executeOperation({ query: PAY_MUTATION, variables: declineVariables }, contextFor(userAToken));
    expect(declineResult.errors).toBeUndefined();
    expect((declineResult.data as any).pay.payment.status).toBe('failed');
    expect((declineResult.data as any).pay.order.status).toBe('created');

    const retryVariables = { orderId: 'order-2', idempotencyKey: 'retry-key', card: VALID_CARD };
    const retryResult = await server.executeOperation({ query: PAY_MUTATION, variables: retryVariables }, contextFor(userAToken));
    expect(retryResult.errors).toBeUndefined();
    expect((retryResult.data as any).pay.payment.status).toBe('succeeded');
    expect((retryResult.data as any).pay.order.status).toBe('paid');
  });

  it('calling pay with no/invalid JWT returns the exact string "Authentication required"', async () => {
    const variables = { orderId: 'order-2', idempotencyKey: 'no-auth-key', card: VALID_CARD };

    const noToken = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(null));
    expect(noToken.errors).toBeDefined();
    expect(noToken.errors![0].message).toBe('Authentication required');

    const invalidToken = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor('not-a-real-token'));
    expect(invalidToken.errors).toBeDefined();
    expect(invalidToken.errors![0].message).toBe('Authentication required');
  });
});
