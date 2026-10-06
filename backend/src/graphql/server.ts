import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers } from './resolvers';
import { OrderQueryService } from '../services/orderQueryService';
import { CartService } from '../services/cartService';
import { PricingService } from '../services/pricingService';
import { CheckoutService } from '../services/checkoutService';
import { PaymentService } from '../services/paymentService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { EncryptionService } from '../services/encryptionService';

interface ApolloServices {
  orderQueryService: OrderQueryService;
  cartService: CartService;
  pricingService: PricingService;
  checkoutService: CheckoutService;
  paymentService: PaymentService;
  authService: AuthService;
  promoService: PromoService;
  encryptionService: EncryptionService;
}

export const createApolloServer = (services: ApolloServices) => {
  const resolvers = createResolvers(services);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return { message: error.message, path: error.path };
    },
    introspection: true,
    playground: true,
  });
};
