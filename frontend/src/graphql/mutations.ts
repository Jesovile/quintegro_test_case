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

// Mutation to save delivery and invoice addresses on an order
export const SET_ORDER_ADDRESSES = gql`
  mutation SetOrderAddresses($input: SetOrderAddressesInput!) {
    setOrderAddresses(input: $input) {
      orderId
      status
      deliveryAddress {
        fullName
        phone
        country
        state
        city
        postalCode
        street
        apartment
      }
      invoiceAddress {
        fullName
        phone
        country
        state
        city
        postalCode
        street
        apartment
      }
      deliveryOption
      deliveryCost
    }
  }
`;

// Mutation to pay for an order — sends payment to the mock bank,
// stores summary, and transitions order status to 'processing'.
export const PAY_ORDER = gql`
  mutation PayOrder($input: PayOrderInput!) {
    payOrder(input: $input) {
      orderId
      status
      payment {
        last4
        cardholder
        expMonth
        expYear
        bankTxnId
        status
      }
    }
  }
`;
