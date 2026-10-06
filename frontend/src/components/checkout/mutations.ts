import { gql } from '@apollo/client'

export const CHECKOUT = gql`
  mutation Checkout($orderId: ID!, $input: CheckoutInput!) {
    checkout(orderId: $orderId, input: $input) {
      paymentId
      paymentUrl
    }
  }
`

export const PAY = gql`
  mutation Pay($paymentId: String!, $card: CardInput!) {
    pay(paymentId: $paymentId, card: $card) {
      orderId
      status
    }
  }
`

export const PAYMENT_WEBHOOK = gql`
  mutation PaymentWebhook($paymentId: String!) {
    paymentWebhook(paymentId: $paymentId) {
      orderId
      status
    }
  }
`

export const CANCEL_ORDER = gql`
  mutation CancelOrder($orderId: ID!) {
    cancelOrder(orderId: $orderId)
  }
`
