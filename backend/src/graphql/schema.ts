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

  type CheckoutData {
    address: String!
    phone: String!
    deliveryAt: String!
    comment: String
  }

  type Promo {
    id: ID!
    discount: Int!
    dueDate: Float!
  }

  enum OrderStatus {
    new
    waitingPayment
    paymentProcess
    inProgress
    delivery
    done
    failed
    canceledByUser
    canceledByCompany
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    createdAt: Float!
    products: [OrderItem!]!
    promo: Promo
    checkoutData: CheckoutData
    paymentId: String
    paymentUrl: String
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

  input CheckoutInput {
    address: String!
    phone: String!
    deliveryAt: String!
    comment: String
  }

  input CardInput {
    encrypted: String!
  }

  type LoginResponse {
    token: String!
  }

  type CheckoutResponse {
    paymentId: String!
    paymentUrl: String!
  }

  type PaymentWebhookResponse {
    orderId: String!
    status: String!
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
    promo(promoId: ID!): Promo
    encryptionPublicKey: String!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    createOrder: Order!
    checkout(orderId: ID!, input: CheckoutInput!): CheckoutResponse!
    cancelOrder(orderId: ID!): Boolean!
    pay(paymentId: String!, card: CardInput!): PaymentWebhookResponse!
    paymentWebhook(paymentId: String!): PaymentWebhookResponse!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
