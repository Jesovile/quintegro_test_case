import { gql } from '@apollo/client';

// Query to get all orders for the authenticated user
export const GET_ORDERS = gql`
  query GetOrders {
    orders {
      orderId
      status
      products {
        product {
          id
          title
          description
          image
        }
        amount
        price
      }
      promo {
        id
        discount
        dueDate
      }
      address {
        fullName
        country
        city
        street
        postalCode
        phone
      }
      deliveryOption {
        id
        provider
        title
        price
        etaDays
        description
      }
      reservedUntil
    }
  }
`;

// Query to get a specific order
export const GET_ORDER = gql`
  query GetOrder($orderId: ID!) {
    order(orderId: $orderId) {
      orderId
      status
      products {
        product {
          id
          title
          description
          image
        }
        amount
        price
      }
      promo {
        id
        discount
        dueDate
      }
      address {
        fullName
        country
        city
        street
        postalCode
        phone
      }
      deliveryOption {
        id
        provider
        title
        price
        etaDays
        description
      }
      reservedUntil
    }
  }
`;

// Query to calculate order sum
export const GET_ORDER_SUM = gql`
  query GetOrderSum($orderId: ID!, $products: [ProductInput!]!, $promo: String) {
    orderSum(orderId: $orderId, products: $products, promo: $promo)
  }
`;

// Query to validate promo code
export const GET_PROMO = gql`
  query GetPromo($promoId: ID!) {
    promo(promoId: $promoId) {
      id
      discount
      dueDate
    }
  }
`;

// Query to get available delivery options for an address
export const GET_DELIVERY_OPTIONS = gql`
  query GetDeliveryOptions($orderId: ID!, $address: AddressInput!) {
    deliveryOptions(orderId: $orderId, address: $address) {
      id
      provider
      title
      price
      etaDays
      description
    }
  }
`;
