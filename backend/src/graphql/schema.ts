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
    price: Float!
  }

  type Promo {
    id: ID!
    discount: Int!
    dueDate: Float!
  }

  type DeliveryInfo {
    recipientName: String!
    phone: String!
    city: String!
    addressLine1: String!
    postalCode: String
  }

  input DeliveryInfoInput {
    recipientName: String!
    phone: String!
    city: String!
    addressLine1: String!
    postalCode: String
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
    deliveryInfo: DeliveryInfo
  }

  enum OrderStatus {
    created
    submited
    finished
  }

  input ProductInput {
    id: ID!
    amount: Int!
    price: Float!
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
    orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
    promo(promoId: ID!): Promo
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!, deliveryInfo: DeliveryInfoInput!): Boolean!
    updateDeliveryInfo(orderId: ID!, deliveryInfo: DeliveryInfoInput!): Order!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
