import { gql } from 'apollo-server-express';
import { CheckoutErrorCode } from '../types/enums';

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
    checkout: Checkout
  }

  input CustomerInfoInput {
    firstName: String!
    lastName: String!
    email: String!
    phone: String!
    address: String!
    zipcode: String!
  }

  input CreditCardInput {
    cardholderName: String!
    number: String!
    expiryMonth: Int!
    expiryYear: Int!
    securityCode: String!
  }

  input CheckoutInput {
    customer: CustomerInfoInput!
    creditCard: CreditCardInput!
  }

  type Checkout {
    orderId: ID!
    userId: ID!
    firstName: String!
    lastName: String!
    email: String!
    phone: String!
    address: String!
    zipcode: String!
    paymentId: ID!
    paymentProvider: String!
  }

  enum SubmissionCode {
    APPROVED
    ${Object.values(CheckoutErrorCode).join('\n    ')}
  }

  type SubmitOrderResult {
    success: Boolean!
    code: SubmissionCode!
    message: String!
    orderId: ID!
    paymentId: ID
    paymentProvider: String
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
    submitOrder(orderId: ID!, input: CheckoutInput!): SubmitOrderResult!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
