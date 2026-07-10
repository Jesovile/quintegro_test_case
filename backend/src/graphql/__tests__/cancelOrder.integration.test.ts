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

// Real Apollo server + real resolver/service stack, mirroring
// pay.integration.test.ts (implementation-plan-06.md iteration 6.3).

const CANCEL_ORDER_MUTATION = `
  mutation CancelOrder($orderId: ID!) {
    cancelOrder(orderId: $orderId) {
      orderId
      status
    }
  }
`;

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

describe('cancelOrder mutation (integration, real resolver/service stack)', () => {
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

  async function payOrder2() {
    const variables = { orderId: 'order-2', idempotencyKey: 'pay-key', card: VALID_CARD };
    const result = await server.executeOperation({ query: PAY_MUTATION, variables }, contextFor(userAToken));
    expect(result.errors).toBeUndefined();
    expect((result.data as any).pay.order.status).toBe('paid');
  }

  it('cancels a paid order owned by the caller, returning status "cancelled"', async () => {
    await payOrder2();

    const result = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables: { orderId: 'order-2' } },
      contextFor(userAToken)
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).cancelOrder.status).toBe('cancelled');
  });

  it('cancelling someone else\'s order returns "Order not found or access denied"', async () => {
    await payOrder2();

    const result = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables: { orderId: 'order-2' } },
      contextFor(userBToken)
    );

    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toBe('Order not found or access denied');
  });

  it('cancelling a non-"paid" order throws the distinct status error, not a generic message', async () => {
    // order-2 is seeded as 'created', never paid in this test
    const result = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables: { orderId: 'order-2' } },
      contextFor(userAToken)
    );

    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toBe('Order cannot be cancelled in its current status');
  });

  it('calling cancelOrder twice on the same order: second call throws the status error, does not silently succeed', async () => {
    await payOrder2();

    const first = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables: { orderId: 'order-2' } },
      contextFor(userAToken)
    );
    expect(first.errors).toBeUndefined();
    expect((first.data as any).cancelOrder.status).toBe('cancelled');

    const second = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables: { orderId: 'order-2' } },
      contextFor(userAToken)
    );
    expect(second.errors).toBeDefined();
    expect(second.errors![0].message).toBe('Order cannot be cancelled in its current status');
  });

  it('calling cancelOrder with no/invalid JWT returns the exact string "Authentication required"', async () => {
    const variables = { orderId: 'order-2' };

    const noToken = await server.executeOperation({ query: CANCEL_ORDER_MUTATION, variables }, contextFor(null));
    expect(noToken.errors).toBeDefined();
    expect(noToken.errors![0].message).toBe('Authentication required');

    const invalidToken = await server.executeOperation(
      { query: CANCEL_ORDER_MUTATION, variables },
      contextFor('not-a-real-token')
    );
    expect(invalidToken.errors).toBeDefined();
    expect(invalidToken.errors![0].message).toBe('Authentication required');
  });
});
