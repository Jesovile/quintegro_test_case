import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers } from './resolvers';
import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';

export const createApolloServer = (orderService: OrderService, authService: AuthService, promoService: PromoService) => {
  const resolvers = createResolvers(orderService, authService, promoService);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
    formatError: (error) => {
      const code = typeof error.extensions?.code === 'string' ? error.extensions.code : 'INTERNAL_SERVER_ERROR';
      // GraphQL coercion/parse errors can echo card values from variables or literals.
      const invalidInput = ['BAD_USER_INPUT', 'GRAPHQL_VALIDATION_FAILED', 'GRAPHQL_PARSE_FAILED'].includes(code);
      return {
        message: invalidInput ? 'Invalid GraphQL request' : error.message,
        path: error.path,
        extensions: { code }
      };
    },
    debug: false,
    introspection: true,
    playground: true
  });
};
