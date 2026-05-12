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
    phone: String!
    country: String!
    state: String!
    city: String!
    postalCode: String!
    street: String!
    apartment: String
  }

  type PaymentSummary {
    last4: String!
    cardholder: String!
    expMonth: Int!
    expYear: Int!
    bankTxnId: String!
    status: PaymentStatus!
  }

  type AddressSuggestion {
    id: ID!
    description: String!
    country: String!
    state: String!
    city: String!
    postalCode: String!
    street: String!
  }

  enum DeliveryOption {
    fast
    super_fast
    extra_fast
  }

  type DeliveryRates {
    fast: Float!
    super_fast: Float!
    extra_fast: Float!
  }

  enum PaymentStatus {
    processing
    authorized
    declined
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    products: [OrderItem!]!
    promo: Promo
    deliveryAddress: Address
    invoiceAddress: Address
    deliveryOption: DeliveryOption
    deliveryCost: Float
    payment: PaymentSummary
  }

  enum OrderStatus {
    created
    submited
    processing
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

  input AddressInput {
    fullName: String!
    phone: String!
    country: String!
    state: String!
    city: String!
    postalCode: String!
    street: String!
    apartment: String
  }

  input SetOrderAddressesInput {
    orderId: ID!
    deliveryAddress: AddressInput!
    invoiceAddress: AddressInput
    sameAsDelivery: Boolean!
    deliveryOption: DeliveryOption!
  }

  input PayOrderInput {
    orderId: ID!
    cardNumber: String!
    cvv: String!
    cardholder: String!
    expMonth: Int!
    expYear: Int!
  }

  type LoginResponse {
    token: String!
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
    promo(promoId: ID!): Promo
    searchAddresses(query: String!): [AddressSuggestion!]!
    deliveryRates(address: AddressInput!): DeliveryRates
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!): Boolean!
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order
    setOrderAddresses(input: SetOrderAddressesInput!): Order!
    payOrder(input: PayOrderInput!): Order!
  }
`;
