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
  mutation SubmitOrder($orderId: ID!, $deliveryInfo: DeliveryInfoInput!) {
    submitOrder(orderId: $orderId, deliveryInfo: $deliveryInfo)
  }
`;

export const UPDATE_DELIVERY_INFO = gql`
  mutation UpdateDeliveryInfo($orderId: ID!, $deliveryInfo: DeliveryInfoInput!) {
    updateDeliveryInfo(orderId: $orderId, deliveryInfo: $deliveryInfo) {
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
      deliveryInfo {
        recipientName
        phone
        city
        addressLine1
        postalCode
      }
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
