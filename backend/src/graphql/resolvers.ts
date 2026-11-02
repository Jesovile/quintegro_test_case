import { Request } from 'express';
import { DomainError } from '../errors/domainError';
import type { GraphQLServices } from './server';

export interface GraphQLContext {
  req: Request;
}

const ORDER_NOT_FOUND_MESSAGE = 'Order not found or access denied';

export const createResolvers = ({ orderService, checkoutService, authService, promoService }: GraphQLServices) => {
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
        const validation = promoService.validatePromo(promoId);

        if (!validation.isValid) {
          if (validation.error === 'Promo expired') {
            throw new DomainError('PROMO_EXPIRED', 'Promo expired');
          }
          throw new DomainError('PROMO_NOT_FOUND', 'Promo not found');
        }

        return validation.promo;
      }
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
      }
    }
  };
};
