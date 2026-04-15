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
    delivery: DeliveryInfo
    payment: PaymentInfo
  }

  enum OrderStatus {
    created
    checkout
    submited
    finished
  }

  enum DeliveryOption {
    fast
    fastest
  }

  type DeliveryInfo {
    name: String!
    addressLine1: String!
    addressLine2: String!
    zip: String!
    city: String!
    country: String!
    phoneCode: String!
    phoneNumber: String!
    option: DeliveryOption!
  }

  type PaymentInfo {
    cardLastFour: String!
    cardHolderName: String!
  }

  input CheckoutInput {
    name: String!
    addressLine1: String!
    addressLine2: String!
    zip: String!
    city: String!
    country: String!
    phoneCode: String!
    phoneNumber: String!
    deliveryOption: DeliveryOption!
    cardNumber: String!
    cardExpiry: String!
    cardCvv: String!
    cardHolderName: String!
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
    submitOrder(orderId: ID!): Boolean!
    startCheckout(orderId: ID!): Boolean!
    checkoutOrder(orderId: ID!, input: CheckoutInput!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
