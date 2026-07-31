import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { CheckoutService } from '../checkout/checkoutService';
import { CheckoutError } from '../checkout/errors';

export const createResolvers = (orderService: OrderService, authService: AuthService, promoService: PromoService, checkoutService: CheckoutService) => {
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
      }
      ,

      checkoutQuote: async (parent: any, { input }: { input: any }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) throw new Error('AUTHENTICATION_REQUIRED');
        try {
          return await checkoutService.createQuote(input, userId);
        } catch (error) {
          throw new Error(error instanceof CheckoutError ? error.code : 'CHECKOUT_QUOTE_FAILED');
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

      submitOrder: async (parent: any, { input }: { input: any }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('AUTHENTICATION_REQUIRED');
        }

        try {
          return await checkoutService.submitOrder(input, userId);
        } catch (error) {
          throw new Error(error instanceof CheckoutError ? error.code : 'CHECKOUT_SUBMISSION_FAILED');
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

      updateProductAmount: async (parent: any, { orderId, productId, amount }: { orderId: string, productId: string, amount: number }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) throw new Error('AUTHENTICATION_REQUIRED');
        const updatedOrder = await orderService.updateProductAmount(orderId, productId, amount, userId);
        if (!updatedOrder) throw new Error('ORDER_NOT_EDITABLE');
        return updatedOrder;
      }
    }
  };
};
