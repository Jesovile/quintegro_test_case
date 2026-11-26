import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers } from './resolvers';
import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { AddressService } from '../services/addressService';
import { DeliveryService } from '../services/deliveryService';

export const createApolloServer = (orderService: OrderService, authService: AuthService, promoService: PromoService, addressService: AddressService, deliveryService: DeliveryService) => {
  const resolvers = createResolvers(orderService, authService, promoService, addressService, deliveryService);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        path: error.path
      };
    },
    introspection: true,
    playground: true
  });
};
