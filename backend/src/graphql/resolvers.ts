import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { AddressService } from '../services/addressService';
import { DeliveryService } from '../services/deliveryService';

export const createResolvers = (orderService: OrderService, authService: AuthService, promoService: PromoService, addressService: AddressService, deliveryService: DeliveryService) => {
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

        // Ignore codes this user can't use (unknown, expired or already used).
        const validation = promo ? promoService.validatePromo(promo, userId) : undefined;
        const usablePromo = validation?.isValid ? validation.promo!.id : undefined;

        try {
          return orderService.calculateOrderSum(products, usablePromo);
        } catch (error) {
          throw new Error('Failed to calculate order sum');
        }
      },

      promo: async (parent: any, { promoId }: { promoId: string }, context: any) => {
        // Signed-in users also get "Promo already used" for codes they redeemed before.
        const userId = extractUserIdFromToken(context) ?? undefined;
        const validation = promoService.validatePromo(promoId, userId);

        if (!validation.isValid) {
          throw new Error(validation.error);
        }

        return validation.promo;
      },

      searchAddresses: (parent: any, { query, limit }: { query: string, limit?: number }) => {
        return addressService.search(query, limit);
      },

      deliveryOptions: () => deliveryService.getOptions(),

      deliveryDays: () => deliveryService.getDays(),

      deliverySlots: (parent: any, { date }: { date: string }) => deliveryService.getSlots(date)
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

      submitOrder: async (parent: any, { orderId, promo }: { orderId: string, promo?: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        // Each promo code can be used once per user: re-check right before placing the order.
        const promoValidation = promo ? promoService.validatePromo(promo, userId) : undefined;
        if (promoValidation && !promoValidation.isValid) {
          throw new Error(promoValidation.error);
        }

        try {
          const success = await orderService.submitOrder(orderId, userId, promoValidation?.promo);
          if (!success) {
            throw new Error('Order not found or access denied');
          }
          if (promoValidation?.promo) {
            promoService.redeem(userId, promoValidation.promo.id);
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
      }
    }
  };
};
