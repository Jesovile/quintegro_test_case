import { Request } from 'express';
import { DomainError } from '../errors/domainError';
import type { GraphQLServices } from './server';
import { OrderDTO } from '../types/entities';
import { DeliveryInput } from '../services/checkoutValidation';
import { PayOrderInput } from '../services/paymentService';

export interface GraphQLContext {
  req: Request;
}

const ORDER_NOT_FOUND_MESSAGE = 'Order not found or access denied';

export const createResolvers = ({ orderService, checkoutService, paymentService, processingService, authService, promoService }: GraphQLServices) => {
  const requireUser = (context: GraphQLContext): string => {
    const authHeader = context.req.headers.authorization;
    const decoded = authHeader?.startsWith('Bearer ') ? authService.verifyToken(authHeader.substring(7)) : null;

    if (!decoded || !decoded.userId) {
      throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    }

    return decoded.userId;
  };

  return {
    Query: {
      orders: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
        return orderService.getOrdersByUserId(requireUser(context));
      },

      order: async (_parent: unknown, { orderId }: { orderId: string }, context: GraphQLContext) => {
        const order = await orderService.getOrderById(orderId, requireUser(context));
        if (!order) {
          throw new DomainError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE);
        }
        return order;
      },

      promo: async (_parent: unknown, { promoId }: { promoId: string }) => {
        return promoService.getActivePromo(promoId);
      },

      me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
        const user = authService.getUser(requireUser(context));
        if (!user) {
          throw new DomainError('UNAUTHENTICATED', 'Authentication required');
        }
        return user;
      }
    },

    Order: {
      // The parent order has already been checked to belong to the requesting user
      delivery: async (order: OrderDTO) => checkoutService.getDelivery(order.orderId)
    },

    Mutation: {
      login: async (_parent: unknown, { input }: { input: { login: string, password: string } }) => {
        const token = await authService.authenticateUser(input.login, input.password);

        if (!token) {
          throw new DomainError('UNAUTHENTICATED', 'Invalid credentials');
        }

        return { token };
      },

      deleteProductFromOrder: async (_parent: unknown, { orderId, productId }: { orderId: string, productId: string }, context: GraphQLContext) => {
        const updatedOrder = await orderService.deleteProductFromOrder(orderId, productId, requireUser(context));
        if (!updatedOrder) {
          throw new DomainError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE);
        }
        return updatedOrder;
      },

      updateProductAmount: async (_parent: unknown, { orderId, productId, amount }: { orderId: string, productId: string, amount: number }, context: GraphQLContext) => {
        const updatedOrder = await orderService.updateProductAmount(orderId, productId, amount, requireUser(context));
        if (!updatedOrder) {
          throw new DomainError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE);
        }
        return updatedOrder;
      },

      startCheckout: async (_parent: unknown, { orderId }: { orderId: string }, context: GraphQLContext) => {
        return checkoutService.startCheckout(orderId, requireUser(context));
      },

      exitCheckout: async (_parent: unknown, { orderId }: { orderId: string }, context: GraphQLContext) => {
        return checkoutService.exitCheckout(orderId, requireUser(context));
      },

      saveDelivery: async (_parent: unknown, { orderId, input }: { orderId: string, input: DeliveryInput }, context: GraphQLContext) => {
        return checkoutService.saveDelivery(orderId, requireUser(context), input);
      },

      applyPromo: async (_parent: unknown, { orderId, code }: { orderId: string, code: string }, context: GraphQLContext) => {
        return checkoutService.applyPromo(orderId, requireUser(context), code);
      },

      removePromo: async (_parent: unknown, { orderId }: { orderId: string }, context: GraphQLContext) => {
        return checkoutService.removePromo(orderId, requireUser(context));
      },

      payOrder: async (_parent: unknown, { orderId, input }: { orderId: string, input: PayOrderInput }, context: GraphQLContext) => {
        return paymentService.payOrder(orderId, requireUser(context), input);
      },

      retryProcessing: async (_parent: unknown, { orderId }: { orderId: string }, context: GraphQLContext) => {
        return processingService.retryProcessing(orderId, requireUser(context));
      }
    }
  };
};
