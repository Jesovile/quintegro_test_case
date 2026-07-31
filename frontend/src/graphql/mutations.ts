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
  mutation SubmitOrder($input: SubmitOrderInput!) {
    submitOrder(input: $input) {
      status
      orderId
      paymentReference
      deliveryReference
      errorCode
      checkout {
        submittedAt
        quote { id fingerprint subtotalMinor discountMinor deliveryFeeMinor totalMinor currency deliveryQuoteId expiresAt }
        payment { status reference brand last4 }
        delivery { quoteId reference method feeMinor estimatedDeliveryAt }
      }
    }
  }
`;

export const UPDATE_PRODUCT_AMOUNT = gql`
  mutation UpdateProductAmount($orderId: ID!, $productId: ID!, $amount: Int!) {
    updateProductAmount(orderId: $orderId, productId: $productId, amount: $amount) {
      orderId
      status
      products { product { id title description image } amount price }
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
