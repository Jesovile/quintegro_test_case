import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers, GraphQLContext } from './resolvers';
import { formatGraphQLError } from './errors';
import { Container } from '../container';

export type GraphQLServices = Pick<Container, 'orderService' | 'checkoutService' | 'paymentService' | 'processingService' | 'authService' | 'promoService'>;

export const createApolloServer = (services: GraphQLServices) => {
  const resolvers = createResolvers(services);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: GraphQLContext) => ({ req }),
    formatError: formatGraphQLError,
    introspection: true
  });
};
