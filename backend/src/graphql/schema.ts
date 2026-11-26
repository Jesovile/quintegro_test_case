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

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
  }

  enum OrderStatus {
    created
    submited
    finished
  }

  type Address {
    id: ID!
    line1: String!
    city: String!
    state: String!
    zip: String!
  }

  enum DeliveryType {
    express
    standard
    scheduled
  }

  """Wall-clock dates (YYYY-MM-DD) and times (HH:mm) in the store time zone."""
  type DeliveryWindow {
    startDate: String!
    endDate: String!
    startTime: String
    endTime: String
  }

  type DeliveryOption {
    type: DeliveryType!
    title: String!
    price: Float!
    window: DeliveryWindow
  }

  type DeliveryDay {
    date: String!
    available: Boolean!
  }

  type DeliverySlot {
    id: ID!
    startTime: String!
    endTime: String!
    available: Boolean!
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
    searchAddresses(query: String!, limit: Int = 8): [Address!]!
    deliveryOptions: [DeliveryOption!]!
    deliveryDays: [DeliveryDay!]!
    deliverySlots(date: String!): [DeliverySlot!]!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!, promo: String): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
