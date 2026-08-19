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

  type Address {
    fullName: String!
    country: String!
    city: String!
    street: String!
    postalCode: String!
    phone: String!
  }

  input AddressInput {
    fullName: String!
    country: String!
    city: String!
    street: String!
    postalCode: String!
    phone: String!
  }

  type DeliveryOption {
    id: ID!
    provider: String!
    title: String!
    price: Float!
    etaDays: Int!
    description: String!
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
    address: Address
    deliveryOption: DeliveryOption
    reservedUntil: Float
  }

  enum OrderStatus {
    created
    reserved
    paid
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

  type ReserveItemIssue {
    productId: ID!
    productTitle: String!
    requested: Int!
    available: Int!
  }

  enum ReserveErrorCode {
    INSUFFICIENT_STOCK
    INVALID_STATUS
    DELIVERY_OPTION_INVALID
  }

  type ReserveResult {
    success: Boolean!
    order: Order
    reservedUntil: Float
    issues: [ReserveItemIssue!]
    errorCode: ReserveErrorCode
  }

  input CardDetailsInput {
    cardNumber: String!
    cardHolder: String!
    expiryMonth: Int!
    expiryYear: Int!
    cvv: String!
  }

  input PaypalDetailsInput {
    email: String!
  }

  enum PaymentMethodType {
    card
    paypal
  }

  input PaymentInput {
    method: PaymentMethodType!
    card: CardDetailsInput
    paypal: PaypalDetailsInput
  }

  enum PaymentErrorCode {
    DECLINED
    INSUFFICIENT_FUNDS
    EXPIRED_CARD
    GATEWAY_UNAVAILABLE
    RESERVATION_EXPIRED
    INVALID_STATUS
  }

  type PaymentResult {
    success: Boolean!
    order: Order
    errorCode: PaymentErrorCode
    errorMessage: String
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
    promo(promoId: ID!): Promo
    deliveryOptions(orderId: ID!, address: AddressInput!): [DeliveryOption!]!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    reserveOrder(orderId: ID!, address: AddressInput!, deliveryOptionId: ID!): ReserveResult!
    payOrder(orderId: ID!, payment: PaymentInput!): PaymentResult!
  }
`;
