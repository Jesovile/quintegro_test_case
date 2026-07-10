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

// Mutation to submit delivery address + method for the current cart order
export const SUBMIT_DELIVERY_DETAILS = gql`
  mutation SubmitDeliveryDetails($orderId: ID!, $address: DeliveryAddressInput!, $deliveryMethodType: DeliveryMethodType!) {
    submitDeliveryDetails(orderId: $orderId, address: $address, deliveryMethodType: $deliveryMethodType) {
      orderId
      deliveryAddress {
        recipientName
        phone
        country
        city
        street
        building
        apartment
        postalCode
      }
      deliveryMethod {
        type
        fee
        estimatedDays
      }
    }
  }
`;

// Mutation to submit a card payment for the current cart order (feature 4).
// Note: pay never throws for a declined card — that's a normal PayResult with
// payment.status === 'failed', not a GraphQL error (tech-design §3.3).
export const PAY = gql`
  mutation Pay($orderId: ID!, $idempotencyKey: String!, $card: CardInput!) {
    pay(orderId: $orderId, idempotencyKey: $idempotencyKey, card: $card) {
      order {
        orderId
        status
      }
      payment {
        paymentId
        status
        cardLast4
        cardholderName
        failureReason
        createdAt
      }
    }
  }
`;

// Mutation to delete a product from an order
// Response fields extended by feature 5 with createAt (needed so OrderList's
// most-recent-first sort keeps working after a local state merge post-delete)
// — deleteProductFromOrder only ever succeeds for 'created' orders now
// (backend guard, iteration 5.1), so delivery/payment fields are never
// meaningfully present here, but createAt always is.
// Mutation to cancel an already-paid order (feature 6, US-601). No confirmation
// dialog on the frontend side — one click cancels, per 06-order-cancellation.md.
export const CANCEL_ORDER = gql`
  mutation CancelOrder($orderId: ID!) {
    cancelOrder(orderId: $orderId) {
      orderId
      status
    }
  }
`;

export const DELETE_PRODUCT_FROM_ORDER = gql`
  mutation DeleteProductFromOrder($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) {
      orderId
      status
      createAt
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
