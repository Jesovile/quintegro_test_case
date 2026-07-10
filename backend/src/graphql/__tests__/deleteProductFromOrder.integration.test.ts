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

// Regression test for a code-review finding: deleteProductFromOrder's resolver
// still had a try/catch swallowing OrderService's new mandatory
// status !== 'created' guard error into a generic message, unlike the
// pay/cancelOrder/submitDeliveryDetails resolvers which deliberately rethrow.

const DELETE_PRODUCT_MUTATION = `
  mutation DeleteProduct($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) {
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

describe('deleteProductFromOrder mutation (integration, real resolver/service stack)', () => {
  let server: ApolloServer;
  let userAToken: string;

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

    userAToken = (await authService.authenticateUser('john.doe', 'password123'))!;
  });

  function contextFor(token: string | null) {
    return {
      req: {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      }
    };
  }

  it('deleting a line item from a paid order surfaces the specific status-guard message, not a generic swallowed error', async () => {
    const payVariables = { orderId: 'order-2', idempotencyKey: 'pay-key', card: VALID_CARD };
    const payResult = await server.executeOperation({ query: PAY_MUTATION, variables: payVariables }, contextFor(userAToken));
    expect(payResult.errors).toBeUndefined();

    const result = await server.executeOperation(
      { query: DELETE_PRODUCT_MUTATION, variables: { orderId: 'order-2', productId: 'product-2' } },
      contextFor(userAToken)
    );

    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toBe('Order cannot be modified in its current status');
  });

  it('deleting a line item from a still-created order still works (no regression)', async () => {
    const result = await server.executeOperation(
      { query: DELETE_PRODUCT_MUTATION, variables: { orderId: 'order-2', productId: 'product-2' } },
      contextFor(userAToken)
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).deleteProductFromOrder.status).toBe('created');
  });
});
