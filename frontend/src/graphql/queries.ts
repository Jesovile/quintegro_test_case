import { gql, TypedDocumentNode } from '@apollo/client';
import { Order, Promo } from '@/types/order';

export const ORDER_FIELDS = gql`
  fragment OrderFields on Order {
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
    totals {
      subtotal
      discount
      total
      currency
    }
  }
`;

// Query to get all orders for the authenticated user
export const GET_ORDERS: TypedDocumentNode<{ orders: Order[] }> = gql`
  ${ORDER_FIELDS}
  query GetOrders {
    orders {
      ...OrderFields
    }
  }
`;

// Query to get a specific order
export const GET_ORDER: TypedDocumentNode<{ order: Order | null }, { orderId: string }> = gql`
  ${ORDER_FIELDS}
  query GetOrder($orderId: ID!) {
    order(orderId: $orderId) {
      ...OrderFields
    }
  }
`;

// Query to validate promo code
export const GET_PROMO: TypedDocumentNode<{ promo: Promo | null }, { promoId: string }> = gql`
  query GetPromo($promoId: ID!) {
    promo(promoId: $promoId) {
      id
      discount
      dueDate
    }
  }
`;
