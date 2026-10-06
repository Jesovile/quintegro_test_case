import { OrderQueryService } from '../services/orderQueryService';
import { CartService } from '../services/cartService';
import { PricingService } from '../services/pricingService';
import { CheckoutService, CheckoutError } from '../services/checkoutService';
import { PaymentService } from '../services/paymentService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { EncryptionService } from '../services/encryptionService';

interface Services {
  orderQueryService: OrderQueryService;
  cartService: CartService;
  pricingService: PricingService;
  checkoutService: CheckoutService;
  paymentService: PaymentService;
  authService: AuthService;
  promoService: PromoService;
  encryptionService: EncryptionService;
}

export const createResolvers = (services: Services) => {
  const {
    orderQueryService,
    cartService,
    pricingService,
    checkoutService,
    paymentService,
    authService,
    promoService,
    encryptionService,
  } = services;

  const extractUserId = (context: any): string | null => {
    const auth = context.req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const decoded = authService.verifyToken(auth.substring(7));
    return decoded?.userId ?? null;
  };

  return {
    Query: {
      orders: async (_: any, __: any, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        return orderQueryService.getOrdersByUserId(userId);
      },

      order: async (_: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        const order = await orderQueryService.getOrderById(orderId, userId);
        if (!order) throw new Error('Order not found or access denied');
        return order;
      },

      orderSum: async (_: any, { products, promo }: { orderId: string; products: any[]; promo?: string }, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        return pricingService.calculateOrderSum(products, promo);
      },

      promo: async (_: any, { promoId }: { promoId: string }) => {
        const validation = promoService.validatePromo(promoId);
        if (!validation.isValid) throw new Error(validation.error ?? 'Invalid promo');
        return validation.promo;
      },

      encryptionPublicKey: () => encryptionService.publicKeyPem,
    },

    Mutation: {
      login: async (_: any, { input }: { input: { login: string; password: string } }) => {
        const token = await authService.authenticateUser(input.login, input.password);
        if (!token) throw new Error('Invalid credentials');
        return { token };
      },

      createOrder: async (_: any, __: any, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        return cartService.createOrder(userId);
      },

      checkout: async (_: any, { orderId, input }: { orderId: string; input: any }, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        try {
          return await checkoutService.checkout(orderId, userId, input);
        } catch (err) {
          if (err instanceof CheckoutError) throw new Error(err.message);
          throw err;
        }
      },

      cancelOrder: async (_: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        try {
          await checkoutService.cancelOrder(orderId, userId);
          return true;
        } catch (err) {
          if (err instanceof CheckoutError) throw new Error(err.message);
          throw err;
        }
      },

      pay: async (_: any, { paymentId, card }: { paymentId: string; card: { encrypted: string } }) => {
        const decrypted = encryptionService.decrypt(card.encrypted);
        const cardData = JSON.parse(decrypted) as { number: string; expiry: string; cvv: string };
        return paymentService.pay(paymentId, cardData);
      },

      paymentWebhook: async (_: any, { paymentId }: { paymentId: string }) => {
        return paymentService.handleWebhook(paymentId);
      },

      deleteProductFromOrder: async (_: any, { orderId, productId }: { orderId: string; productId: string }, context: any) => {
        const userId = extractUserId(context);
        if (!userId) throw new Error('Authentication required');
        const updated = await cartService.deleteProductFromOrder(orderId, productId, userId);
        if (!updated) throw new Error('Order not found or access denied');
        return updated;
      },
    },
  };
};
