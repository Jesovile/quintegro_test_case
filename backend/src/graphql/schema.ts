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

  type Shipping {
    fullName: String!
    address: String!
    city: String!
    zip: String!
    country: String!
    phone: String!
  }

  type Payment {
    brand: String!
    last4: String!
    holderName: String!
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    createAt: Float!
    placedAt: Float
    canceledAt: Float
    products: [OrderItem!]!
    promo: Promo
    shipping: Shipping
    payment: Payment
  }

  enum OrderStatus {
    created
    checkout
    submited
    finished
    canceled
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

  input ShippingInput {
    fullName: String!
    address: String!
    city: String!
    zip: String!
    country: String!
    phone: String!
  }

  input CardInput {
    number: String!
    holderName: String!
    expiryMonth: Int!
    expiryYear: Int!
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
    submitOrder(orderId: ID!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    startCheckout(orderId: ID!): Order!
    updateCheckout(orderId: ID!, shipping: ShippingInput!): Order!
    placeOrder(orderId: ID!, card: CardInput!): Order!
    cancelCheckout(orderId: ID!): Order!
  }
`;
