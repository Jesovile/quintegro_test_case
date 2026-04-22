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
