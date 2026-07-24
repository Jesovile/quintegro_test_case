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
    country: String!
    city: String!
    streetAndHouseNumber: String!
    postalCode: String!
    phone: String!
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
    recipientName: String
    shippingAddress: Address
    billingAddress: Address
    comment: String
    paymentMethodId: String
  }

  enum OrderStatus {
    created
    submitted
    paid
    in_delivery
    finished
    cancelled
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

  type PaymentMethod {
    id: ID!
    label: String!
  }

  input AddressInput {
    country: String!
    city: String!
    streetAndHouseNumber: String!
    postalCode: String!
    phone: String!
  }

  input CheckoutInput {
    recipientName: String!
    shipping: AddressInput!
    billing: AddressInput
    comment: String
    paymentMethodId: String!
  }

  input PaymentInput {
    cardNumber: String
    cardExpiry: String
    cardCvc: String
    cardholderName: String
  }

  type PayOrderResult {
    success: Boolean!
    order: Order!
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
    promo(promoId: ID!): Promo
    paymentMethods: [PaymentMethod!]!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!, input: CheckoutInput!): Order!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    payOrder(orderId: ID!, input: PaymentInput): PayOrderResult!
    cancelOrder(orderId: ID!): Order!
  }
`;
