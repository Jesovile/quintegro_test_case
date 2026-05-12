import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./schema";
import { createResolvers } from "./resolvers";
import { OrderService } from "../services/orderService";
import { AuthService } from "../services/authService";
import { PromoService } from "../services/promoService";
import { MockGoogleAddressService } from "../services/mockGoogleAddressService";

export const createApolloServer = (
  orderService: OrderService,
  authService: AuthService,
  promoService: PromoService,
  addressService: MockGoogleAddressService,
) => {
  const resolvers = createResolvers(
    orderService,
    authService,
    promoService,
    addressService,
  );

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
    formatError: (error) => {
      console.error("GraphQL Error:", error);
      return {
        message: error.message,
        path: error.path,
      };
    },
    introspection: true,
    playground: true,
  });
};
