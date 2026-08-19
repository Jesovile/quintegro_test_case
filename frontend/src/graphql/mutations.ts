import { gql } from '@apollo/client';

// Mutation for user login
export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;

// Mutation to submit an order
export const SUBMIT_ORDER = gql`
  mutation SubmitOrder($orderId: ID!) {
    submitOrder(orderId: $orderId)
  }
`;

// Mutation to delete a product from an order
export const DELETE_PRODUCT_FROM_ORDER = gql`
  mutation DeleteProductFromOrder($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) {
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

// Mutation to reserve order items ahead of payment
export const RESERVE_ORDER = gql`
  mutation ReserveOrder($orderId: ID!, $address: AddressInput!, $deliveryOptionId: ID!) {
    reserveOrder(orderId: $orderId, address: $address, deliveryOptionId: $deliveryOptionId) {
      success
      reservedUntil
      errorCode
      issues {
        productId
        productTitle
        requested
        available
      }
      order {
        orderId
        status
      }
    }
  }
`;

// Mutation to charge payment for a reserved order
export const PAY_ORDER = gql`
  mutation PayOrder($orderId: ID!, $payment: PaymentInput!) {
    payOrder(orderId: $orderId, payment: $payment) {
      success
      errorCode
      errorMessage
      order {
        orderId
        status
      }
    }
  }
`;
