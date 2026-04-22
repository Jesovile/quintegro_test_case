import { gql } from '@apollo/client';

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
  }
`;
