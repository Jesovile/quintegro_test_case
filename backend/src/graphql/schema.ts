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
    deliveryAddress: DeliveryAddress
    deliveryMethod: DeliveryMethodSnapshot
    payment: PaymentSummary
    total: Float!
    createAt: Float!
  }

  enum OrderStatus {
    created
    submited
    finished
    paid
    cancelled
  }

  enum PaymentStatus {
    pending
    processing
    succeeded
    failed
  }

  type PaymentSummary {
    paymentId: ID!
    status: PaymentStatus!
    cardLast4: String!
    cardholderName: String!
    failureReason: String
    createdAt: Float!
  }

  input CardInput {
    cardNumber: String!
    expiry: String!
    cvv: String!
    cardholderName: String!
  }

  type PayResult {
    order: Order!
    payment: PaymentSummary!
  }

  enum DeliveryMethodType {
    regular
    extra
  }

  type DeliveryAddress {
    recipientName: String!
    phone: String!
    country: String!
    city: String!
    street: String!
    building: String!
    apartment: String
    postalCode: String!
  }

  type DeliveryMethodOption {
    type: DeliveryMethodType!
    label: String!
    fee: Float!
    estimatedDays: String!
  }

  type DeliveryMethodSnapshot {
    type: DeliveryMethodType!
    fee: Float!
    estimatedDays: String!
  }

  input DeliveryAddressInput {
    recipientName: String!
    phone: String!
    country: String!
    city: String!
    street: String!
    building: String!
    apartment: String
    postalCode: String!
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
    currentCart: Order
    deliveryMethods: [DeliveryMethodOption!]!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    submitDeliveryDetails(orderId: ID!, address: DeliveryAddressInput!, deliveryMethodType: DeliveryMethodType!): Order!
    pay(orderId: ID!, idempotencyKey: String!, card: CardInput!): PayResult!
    cancelOrder(orderId: ID!): Order!
  }
`;
