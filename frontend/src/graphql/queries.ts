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

// Query to search mock US shipping addresses (checkout address picker)
export const SEARCH_ADDRESSES = gql`
  query SearchAddresses($query: String!, $limit: Int) {
    searchAddresses(query: $query, limit: $limit) {
      id
      line1
      city
      state
      zip
    }
  }
`;

// Delivery options from our delivery partner + days that can be booked for a time slot
export const GET_DELIVERY_OPTIONS = gql`
  query GetDeliveryOptions {
    deliveryOptions {
      type
      title
      price
      window {
        startDate
        endDate
        startTime
        endTime
      }
    }
    deliveryDays {
      date
      available
    }
  }
`;

// Time slots for one delivery day
export const GET_DELIVERY_SLOTS = gql`
  query GetDeliverySlots($date: String!) {
    deliverySlots(date: $date) {
      id
      startTime
      endTime
      available
    }
  }
`;
