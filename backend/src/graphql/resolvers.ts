import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { CheckoutService } from '../services/checkoutService';

export const createResolvers = (
  orderService: OrderService,
  authService: AuthService,
  promoService: PromoService,
  checkoutService: CheckoutService
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
      },

      deliveryOptions: async (parent: any, { orderId, address }: { orderId: string, address: any }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const options = checkoutService.getDeliveryOptions(orderId, userId, address);
        if (options === null) {
          throw new Error('Order not found or access denied');
        }
        return options;
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

      deleteProductFromOrder: async (parent: any, { orderId, productId }: { orderId: string, productId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const updatedOrder = await orderService.deleteProductFromOrder(orderId, productId, userId);
          if (!updatedOrder) {
            throw new Error('Order not found or access denied');
          }
          return updatedOrder;
        } catch (error) {
          throw new Error('Failed to delete product from order');
        }
      },

      reserveOrder: async (parent: any, { orderId, address, deliveryOptionId }: { orderId: string, address: any, deliveryOptionId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const result = await checkoutService.reserveOrder(orderId, userId, address, deliveryOptionId);
        if (result === null) {
          throw new Error('Order not found or access denied');
        }
        return result;
      },

      payOrder: async (parent: any, { orderId, payment }: { orderId: string, payment: any }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        const result = await checkoutService.payOrder(orderId, userId, payment);
        if (result === null) {
          throw new Error('Order not found or access denied');
        }
        return result;
      }
    }
  };
};
