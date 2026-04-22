import { gql } from '@apollo/client';

export const ORDER_FIELDS = gql`
  fragment OrderFields on Order {
    orderId
    status
    createAt
    placedAt
    canceledAt
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
    shipping {
      fullName
      address
      city
      zip
      country
      phone
    }
    payment {
      brand
      last4
      holderName
    }
  }
`;
