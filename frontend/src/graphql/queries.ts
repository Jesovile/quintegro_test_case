import { gql } from '@apollo/client';
import { ORDER_FIELDS } from './fragments';

export const GET_ORDERS = gql`
  query GetOrders {
    orders {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const GET_ORDER = gql`
  query GetOrder($orderId: ID!) {
    order(orderId: $orderId) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const GET_ORDER_SUM = gql`
  query GetOrderSum($orderId: ID!, $products: [ProductInput!]!, $promo: String) {
    orderSum(orderId: $orderId, products: $products, promo: $promo)
  }
`;

export const GET_PROMO = gql`
  query GetPromo($promoId: ID!) {
    promo(promoId: $promoId) {
      id
      discount
      dueDate
    }
  }
`;
