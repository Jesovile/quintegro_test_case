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
    waiting_payment
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

  enum PaymentMethod {
    card
    paypal
  }

  input DeliveryInput {
    postalCode: String!
    street: String!
    city: String!
  }

  input PaymentInput {
    method: PaymentMethod!
    cardNumber: String
    cardholderName: String
    expiryDate: String
    cvv: String
    paypalEmail: String
  }

  input CheckoutInput {
    delivery: DeliveryInput!
    payment: PaymentInput!
  }

  type CheckoutResponse {
    success: Boolean!
    error: String
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
    submitOrder(orderId: ID!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    processPayment(orderId: ID!, input: CheckoutInput!): CheckoutResponse!
  }
`;
