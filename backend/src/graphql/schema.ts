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
    checkout: CheckoutSnapshot
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

  input CartLineInput {
    productId: ID!
    quantity: Int!
  }

  input DeliveryAddressInput {
    fullName: String!
    street: String!
    city: String!
    postalCode: String!
    country: String!
  }

  enum DeliveryMethod {
    standard
    express
  }

  input CheckoutQuoteInput {
    orderId: ID!
    products: [CartLineInput!]!
    promoCode: String
    deliveryAddress: DeliveryAddressInput!
    deliveryMethod: DeliveryMethod!
  }

  type CheckoutQuote {
    id: ID!
    fingerprint: String!
    subtotalMinor: Int!
    discountMinor: Int!
    deliveryFeeMinor: Int!
    totalMinor: Int!
    currency: String!
    deliveryQuoteId: ID!
    expiresAt: Float!
  }

  input PaymentMethodInput {
    token: String!
    brand: String!
    last4: String!
  }

  input SubmitOrderInput {
    orderId: ID!
    attemptId: ID!
    quoteId: ID!
    quoteFingerprint: String!
    expectedTotalMinor: Int!
    paymentMethod: PaymentMethodInput!
  }

  type CheckoutPayment {
    status: String!
    reference: String!
    brand: String!
    last4: String!
  }

  type CheckoutDelivery {
    quoteId: ID!
    reference: String!
    method: DeliveryMethod!
    feeMinor: Int!
    estimatedDeliveryAt: Float!
  }

  type PersistedQuote {
    id: ID!
    fingerprint: String!
    subtotalMinor: Int!
    discountMinor: Int!
    deliveryFeeMinor: Int!
    totalMinor: Int!
    currency: String!
    deliveryQuoteId: ID!
    expiresAt: Float!
  }

  type CheckoutSnapshot {
    quote: PersistedQuote!
    payment: CheckoutPayment!
    delivery: CheckoutDelivery!
    submittedAt: Float!
  }

  type SubmitOrderPayload {
    status: String!
    orderId: ID!
    checkout: CheckoutSnapshot
    paymentReference: String
    deliveryReference: String
    errorCode: String
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
    checkoutQuote(input: CheckoutQuoteInput!): CheckoutQuote!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(input: SubmitOrderInput!): SubmitOrderPayload!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    updateProductAmount(orderId: ID!, productId: ID!, amount: Int!): Order
  }
`;
