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
      checkout {
        submittedAt
        quote { id fingerprint subtotalMinor discountMinor deliveryFeeMinor totalMinor currency deliveryQuoteId expiresAt }
        payment { status reference brand last4 }
        delivery { quoteId reference method feeMinor estimatedDeliveryAt }
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
      checkout {
        submittedAt
        quote { id fingerprint subtotalMinor discountMinor deliveryFeeMinor totalMinor currency deliveryQuoteId expiresAt }
        payment { status reference brand last4 }
        delivery { quoteId reference method feeMinor estimatedDeliveryAt }
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

export const GET_CHECKOUT_QUOTE = gql`
  query CheckoutQuote($input: CheckoutQuoteInput!) {
    checkoutQuote(input: $input) {
      id
      fingerprint
      subtotalMinor
      discountMinor
      deliveryFeeMinor
      totalMinor
      currency
      deliveryQuoteId
      expiresAt
    }
  }
`;
