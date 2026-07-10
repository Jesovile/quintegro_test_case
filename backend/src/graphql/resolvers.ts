import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { PaymentService, CardInput } from '../services/paymentService';
import { IDeliveryMethodRepository } from '../repositories/interfaces';
import { DeliveryAddress, DeliveryMethodType } from '../types/entities';

export const createResolvers = (
  orderService: OrderService,
  authService: AuthService,
  promoService: PromoService,
  deliveryMethodRepository: IDeliveryMethodRepository,
  paymentService: PaymentService
) => {
  const extractUserIdFromToken = (context: any): string | null => {
    const authHeader = context.req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  };

  return {
    Query: {
      orders: async (parent: any, args: any, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          return await orderService.getOrdersByUserId(userId);
        } catch (error) {
          throw new Error('Failed to fetch orders');
        }
      },

      order: async (parent: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const order = await orderService.getOrderById(orderId, userId);
          if (!order) {
            throw new Error('Order not found or access denied');
          }
          return order;
        } catch (error) {
          throw new Error('Failed to fetch order');
        }
      },

      orderSum: async (parent: any, { orderId, products, promo }: { orderId: string, products: any[], promo?: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          return orderService.calculateOrderSum(products, promo);
        } catch (error) {
          throw new Error('Failed to calculate order sum');
        }
      },

      currentCart: async (parent: any, args: any, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        return orderService.getCurrentCart(userId);
      },

      deliveryMethods: async (parent: any, args: any, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        return deliveryMethodRepository.findAll();
      },

      promo: async (parent: any, { promoId }: { promoId: string }, context: any) => {
        try {
          const validation = promoService.validatePromo(promoId);
          
          if (!validation.isValid) {
            if (validation.error === 'Promo not found') {
              throw new Error('Promo not found');
            } else if (validation.error === 'Promo expired') {
              throw new Error('Promo expired');
            }
          }

          return validation.promo;
        } catch (error) {
          throw new Error('Failed to fetch promo');
        }
      }
    },

    Mutation: {
      login: async (parent: any, { input }: { input: { login: string, password: string } }, context: any) => {
        try {
          const token = await authService.authenticateUser(input.login, input.password);
          
          if (!token) {
            throw new Error('Invalid credentials');
          }

          return { token };
        } catch (error) {
          throw new Error('Login failed');
        }
      },

      submitOrder: async (parent: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const success = await orderService.submitOrder(orderId, userId);
          if (!success) {
            throw new Error('Order not found or access denied');
          }
          return success;
        } catch (error) {
          throw new Error('Failed to submit order');
        }
      },

      // No try/catch here (unlike submitOrder above) — the mandatory
      // status !== 'created' guard added to OrderService.deleteProductFromOrder
      // (tech-design §4.6) throws a specific error that must reach the client
      // verbatim, matching the rethrow-not-swallow pattern used by
      // submitDeliveryDetails/pay/cancelOrder below. The existing
      // not-found/not-owned check still explicitly throws its own message.
      deleteProductFromOrder: async (parent: any, { orderId, productId }: { orderId: string, productId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const updatedOrder = await orderService.deleteProductFromOrder(orderId, productId, userId);
        if (!updatedOrder) {
          throw new Error('Order not found or access denied');
        }
        return updatedOrder;
      },

      // Deliberate deviation from the legacy catch-and-swallow pattern above
      // (tech-design §3.3): no try/catch here — a thrown error propagates
      // verbatim to the client so the frontend can distinguish
      // 'Order not found or access denied' from other failures.
      submitDeliveryDetails: async (
        parent: any,
        { orderId, address, deliveryMethodType }: { orderId: string; address: DeliveryAddress; deliveryMethodType: DeliveryMethodType },
        context: any
      ) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const updatedOrder = await orderService.setDeliveryDetails(orderId, userId, address, deliveryMethodType);
        if (!updatedOrder) {
          throw new Error('Order not found or access denied');
        }
        return updatedOrder;
      },

      // Deliberate deviation from the legacy catch-and-swallow pattern above
      // (tech-design §3.3): no try/catch here — a thrown error propagates
      // verbatim to the client so the frontend can distinguish
      // 'Order not found or access denied' from a status error from a
      // validation error, instead of one generic string. A declined card is
      // NOT an error here — it's a normal PayResult with payment.status
      // === 'failed', so this resolver never throws for a merchant decline.
      pay: async (
        parent: any,
        { orderId, idempotencyKey, card }: { orderId: string; idempotencyKey: string; card: CardInput },
        context: any
      ) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        return await paymentService.pay(orderId, userId, idempotencyKey, card);
      },

      // Deliberate deviation from the legacy catch-and-swallow pattern above
      // (tech-design §3.3): no try/catch here — orderService.cancelOrder's own
      // 'Order cannot be cancelled in its current status' error propagates
      // verbatim to the client, satisfying AC-601-4.
      cancelOrder: async (parent: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const updatedOrder = await orderService.cancelOrder(orderId, userId);
        if (!updatedOrder) {
          throw new Error('Order not found or access denied');
        }
        return updatedOrder;
      }
    }
  };
};
