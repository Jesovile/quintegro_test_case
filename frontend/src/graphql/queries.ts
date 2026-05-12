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
      deliveryAddress {
        fullName
        phone
        country
        state
        city
        postalCode
        street
        apartment
      }
      invoiceAddress {
        fullName
        phone
        country
        state
        city
        postalCode
        street
        apartment
      }
      deliveryOption
      deliveryCost
      payment {
        last4
        cardholder
        expMonth
        expYear
        bankTxnId
        status
      }
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

// Query the mocked Google address service for autocomplete suggestions.
export const SEARCH_ADDRESSES = gql`
  query SearchAddresses($query: String!) {
    searchAddresses(query: $query) {
      id
      description
      country
      state
      city
      postalCode
      street
    }
  }
`;

// Fetch the three delivery rates for a given verified address.
export const DELIVERY_RATES = gql`
  query DeliveryRates($address: AddressInput!) {
    deliveryRates(address: $address) {
      fast
      super_fast
      extra_fast
    }
  }
`;
