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
    deliveryType: DeliveryType
    shippingAddress: String
    paymentMethod: PaymentMethod
    currency: Currency
    deliveryCost: Float
    totalCost: Float
  }

  enum OrderStatus {
    created
    submited
    finished
  }

  enum DeliveryType {
    standard
    express
  }

  enum PaymentMethod {
    card
    paypal
  }

  enum Currency {
    USD
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

  input CardPaymentInput {
    cardNumber: String!
    cardHolder: String!
    expiryDate: String!
    cvv: String!
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
    submitOrder(
      orderId: ID!
      deliveryType: DeliveryType!
      shippingAddress: String!
      paymentMethod: PaymentMethod!
      currency: Currency!
      deliveryCost: Float!
    ): Boolean!
    processPayment(orderId: ID!, input: CardPaymentInput): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
  }
`;
