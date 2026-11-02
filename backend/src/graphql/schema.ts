import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Product {
    id: ID!
    title: String!
    description: String!
    image: String!
  }

  type OrderItem {
    product: Product!
    amount: Int!
    price: Int!
  }

  type Promo {
    id: ID!
    discount: Int!
    dueDate: Float!
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
    totals: OrderTotals!
  }

  type OrderTotals {
    subtotal: Int!
    discount: Int!
    total: Int!
    currency: Currency!
  }

  enum Currency {
    USD
  }

  enum OrderStatus {
    created
    checkout
    paid
    processing
    deliver
    cancelled
  }

  input LoginInput {
    login: String!
    password: String!
  }

  type LoginResponse {
    token: String!
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    promo(promoId: ID!): Promo
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order!
    updateProductAmount(orderId: ID!, productId: ID!, amount: Int!): Order!
    startCheckout(orderId: ID!): Order!
    exitCheckout(orderId: ID!): Order!
  }
`;
