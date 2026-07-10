import { gql } from '@apollo/client';

// Query to get all orders for the authenticated user
// Extended by feature 5 (order confirmation & history, AC-503-1/503-3) with
// deliveryAddress/deliveryMethod/payment/total/createAt — createAt backs the
// most-recent-first client-side sort in OrderList.tsx.
export const GET_ORDERS = gql`
  query GetOrders {
    orders {
      orderId
      status
      createAt
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
        recipientName
        phone
        country
        city
        street
        building
        apartment
        postalCode
      }
      deliveryMethod {
        type
        fee
        estimatedDays
      }
      payment {
        paymentId
        status
        cardLast4
        cardholderName
        failureReason
        createdAt
      }
      total
    }
  }
`;

// Query to get a specific order
// Same field set as GET_ORDERS (feature 5) — used by CheckoutConfirmationPage
// (AC-501-1) which needs items/address/method/total/payment for a single order.
export const GET_ORDER = gql`
  query GetOrder($orderId: ID!) {
    order(orderId: $orderId) {
      orderId
      status
      createAt
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
        recipientName
        phone
        country
        city
        street
        building
        apartment
        postalCode
      }
      deliveryMethod {
        type
        fee
        estimatedDays
      }
      payment {
        paymentId
        status
        cardLast4
        cardholderName
        failureReason
        createdAt
      }
      total
    }
  }
`;

// Query to calculate order sum
export const GET_ORDER_SUM = gql`
  query GetOrderSum($orderId: ID!, $products: [ProductInput!]!, $promo: String) {
    orderSum(orderId: $orderId, products: $products, promo: $promo)
  }
`;

// Query to get the current user's cart (single `created`-status order, or null)
// Extended by feature 2 with deliveryAddress/deliveryMethod; feature 3 will
// further extend this with `total` (additive, not a rewrite).
export const GET_CURRENT_CART = gql`
  query GetCurrentCart {
    currentCart {
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
      deliveryAddress {
        recipientName
        phone
        country
        city
        street
        building
        apartment
        postalCode
      }
      deliveryMethod {
        type
        fee
        estimatedDays
      }
      total
    }
  }
`;

// Query to get the delivery method catalog (Regular / Extra)
export const GET_DELIVERY_METHODS = gql`
  query GetDeliveryMethods {
    deliveryMethods {
      type
      label
      fee
      estimatedDays
    }
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
