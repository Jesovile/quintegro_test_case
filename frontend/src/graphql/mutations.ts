import { gql } from '@apollo/client';
import { ORDER_FIELDS } from './fragments';

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;

export const SUBMIT_ORDER = gql`
  mutation SubmitOrder($orderId: ID!) {
    submitOrder(orderId: $orderId)
  }
`;

export const DELETE_PRODUCT_FROM_ORDER = gql`
  mutation DeleteProductFromOrder($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const START_CHECKOUT = gql`
  mutation StartCheckout($orderId: ID!) {
    startCheckout(orderId: $orderId) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const UPDATE_CHECKOUT = gql`
  mutation UpdateCheckout($orderId: ID!, $shipping: ShippingInput!) {
    updateCheckout(orderId: $orderId, shipping: $shipping) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const PLACE_ORDER = gql`
  mutation PlaceOrder($orderId: ID!, $card: CardInput!) {
    placeOrder(orderId: $orderId, card: $card) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const CANCEL_CHECKOUT = gql`
  mutation CancelCheckout($orderId: ID!) {
    cancelCheckout(orderId: $orderId) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;
