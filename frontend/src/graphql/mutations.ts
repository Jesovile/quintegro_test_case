import { gql, TypedDocumentNode } from '@apollo/client';
import { Order } from '@/types/order';
import { ORDER_FIELDS } from './queries';

// Mutation for user login
export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
    }
  }
`;

// Mutation to change the amount of a product in an order
export const UPDATE_PRODUCT_AMOUNT: TypedDocumentNode<
  { updateProductAmount: Order },
  { orderId: string; productId: string; amount: number }
> = gql`
  ${ORDER_FIELDS}
  mutation UpdateProductAmount($orderId: ID!, $productId: ID!, $amount: Int!) {
    updateProductAmount(orderId: $orderId, productId: $productId, amount: $amount) {
      ...OrderFields
    }
  }
`;

// Mutation to freeze the order and enter checkout
export const START_CHECKOUT: TypedDocumentNode<{ startCheckout: Order }, { orderId: string }> = gql`
  ${ORDER_FIELDS}
  mutation StartCheckout($orderId: ID!) {
    startCheckout(orderId: $orderId) {
      ...OrderFields
    }
  }
`;

// Mutation to leave checkout and make the order editable again
export const EXIT_CHECKOUT: TypedDocumentNode<{ exitCheckout: Order }, { orderId: string }> = gql`
  ${ORDER_FIELDS}
  mutation ExitCheckout($orderId: ID!) {
    exitCheckout(orderId: $orderId) {
      ...OrderFields
    }
  }
`;

// Mutation to delete a product from an order
export const DELETE_PRODUCT_FROM_ORDER: TypedDocumentNode<
  { deleteProductFromOrder: Order },
  { orderId: string; productId: string }
> = gql`
  ${ORDER_FIELDS}
  mutation DeleteProductFromOrder($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) {
      ...OrderFields
    }
  }
`;
