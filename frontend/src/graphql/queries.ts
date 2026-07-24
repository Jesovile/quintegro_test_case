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
      recipientName
      shippingAddress {
        country
        city
        streetAndHouseNumber
        postalCode
        phone
      }
      billingAddress {
        country
        city
        streetAndHouseNumber
        postalCode
        phone
      }
      comment
      paymentMethodId
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
      recipientName
      shippingAddress {
        country
        city
        streetAndHouseNumber
        postalCode
        phone
      }
      billingAddress {
        country
        city
        streetAndHouseNumber
        postalCode
        phone
      }
      comment
      paymentMethodId
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

// Query to get the available payment methods (backend-driven)
export const GET_PAYMENT_METHODS = gql`
  query GetPaymentMethods {
    paymentMethods {
      id
      label
    }
  }
`;
