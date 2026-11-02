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
    price: Int!
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
    # false when there is no promo or it has expired; an expired promo gives no discount
    promoActive: Boolean!
    totals: OrderTotals!
    deliverySaved: Boolean!
    # Requested only by the checkout: the address is read from the Geo service
    delivery: Delivery
  }

  type UsAddress {
    line1: String!
    line2: String
    city: String!
    state: String!
    zip: String!
  }

  type Delivery {
    fullName: String!
    email: String!
    phone: String!
    address: UsAddress!
  }

  input UsAddressInput {
    line1: String!
    line2: String
    city: String!
    state: String!
    zip: String!
  }

  input DeliveryInput {
    fullName: String!
    email: String!
    phone: String!
    address: UsAddressInput!
  }

  type User {
    id: ID!
    name: String!
  }

  type OrderTotals {
    subtotal: Int!
    discount: Int!
    total: Int!
    currency: Currency!
  }

  enum Currency {
    USD
  }

  enum OrderStatus {
    created
    checkout
    paid
    processing
    deliver
    cancelled
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
    promo(promoId: ID!): Promo
    me: User!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order!
    updateProductAmount(orderId: ID!, productId: ID!, amount: Int!): Order!
    startCheckout(orderId: ID!): Order!
    exitCheckout(orderId: ID!): Order!
    saveDelivery(orderId: ID!, input: DeliveryInput!): Order!
    applyPromo(orderId: ID!, code: String!): Order!
    removePromo(orderId: ID!): Order!
  }
`;
