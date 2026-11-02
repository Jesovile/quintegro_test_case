import { gql, TypedDocumentNode } from '@apollo/client';
import { Delivery, DeliveryInput, Order } from '@/types/order';
import { DELIVERY_FIELDS, ORDER_FIELDS } from './queries';

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

// Mutation to validate and save contact and delivery address
export const SAVE_DELIVERY: TypedDocumentNode<
  { saveDelivery: Order & { delivery: Delivery | null } },
  { orderId: string; input: DeliveryInput }
> = gql`
  ${ORDER_FIELDS}
  ${DELIVERY_FIELDS}
  mutation SaveDelivery($orderId: ID!, $input: DeliveryInput!) {
    saveDelivery(orderId: $orderId, input: $input) {
      ...OrderFields
      ...DeliveryFields
    }
  }
`;

// Mutation to apply a promo code to an order in checkout
export const APPLY_PROMO: TypedDocumentNode<{ applyPromo: Order }, { orderId: string; code: string }> = gql`
  ${ORDER_FIELDS}
  mutation ApplyPromo($orderId: ID!, $code: String!) {
    applyPromo(orderId: $orderId, code: $code) {
      ...OrderFields
    }
  }
`;

// Mutation to remove the promo code from an order in checkout
export const REMOVE_PROMO: TypedDocumentNode<{ removePromo: Order }, { orderId: string }> = gql`
  ${ORDER_FIELDS}
  mutation RemovePromo($orderId: ID!) {
    removePromo(orderId: $orderId) {
      ...OrderFields
    }
  }
`;

// Mutation to pay for an order in checkout with a card token from the tokenizer
export const PAY_ORDER: TypedDocumentNode<
  { payOrder: Order },
  { orderId: string; input: { cardToken: string; expectedTotal: number } }
> = gql`
  ${ORDER_FIELDS}
  mutation PayOrder($orderId: ID!, $input: PayOrderInput!) {
    payOrder(orderId: $orderId, input: $input) {
      ...OrderFields
    }
  }
`;

// Mutation to restart processing after it failed
export const RETRY_PROCESSING: TypedDocumentNode<{ retryProcessing: Order }, { orderId: string }> = gql`
  ${ORDER_FIELDS}
  mutation RetryProcessing($orderId: ID!) {
    retryProcessing(orderId: $orderId) {
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
