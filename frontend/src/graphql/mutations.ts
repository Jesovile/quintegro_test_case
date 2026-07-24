import { gql } from '@apollo/client';

// Mutation for user login
export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;

// Mutation to submit the checkout details for an order, moving it from
// Created to Submitted and persisting recipient/shipping/billing/comment/
// payment method.
export const SUBMIT_ORDER = gql`
  mutation SubmitOrder($orderId: ID!, $input: CheckoutInput!) {
    submitOrder(orderId: $orderId, input: $input) {
      orderId
      status
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

// Mutation to attempt (mocked) payment on a Submitted order
export const PAY_ORDER = gql`
  mutation PayOrder($orderId: ID!, $input: PaymentInput) {
    payOrder(orderId: $orderId, input: $input) {
      success
      order {
        orderId
        status
      }
    }
  }
`;

// Mutation to cancel an order (only while Created or Submitted)
export const CANCEL_ORDER = gql`
  mutation CancelOrder($orderId: ID!) {
    cancelOrder(orderId: $orderId) {
      orderId
      status
    }
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
