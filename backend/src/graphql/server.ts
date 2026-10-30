import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers, GraphQLContext } from './resolvers';
import { formatGraphQLError } from './errors';
import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';

export const createApolloServer = (orderService: OrderService, authService: AuthService, promoService: PromoService) => {
  const resolvers = createResolvers(orderService, authService, promoService);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: GraphQLContext) => ({ req }),
    formatError: formatGraphQLError,
    introspection: true
  });
};
