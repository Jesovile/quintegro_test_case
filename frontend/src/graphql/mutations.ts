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
  mutation SubmitOrder(
    $orderId: ID!
    $deliveryType: DeliveryType!
    $shippingAddress: String!
    $paymentMethod: PaymentMethod!
    $currency: Currency!
    $deliveryCost: Float!
  ) {
    submitOrder(
      orderId: $orderId
      deliveryType: $deliveryType
      shippingAddress: $shippingAddress
      paymentMethod: $paymentMethod
      currency: $currency
      deliveryCost: $deliveryCost
    )
  }
`;

export const PROCESS_PAYMENT = gql`
  mutation ProcessPayment($orderId: ID!, $input: CardPaymentInput) {
    processPayment(orderId: $orderId, input: $input)
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
