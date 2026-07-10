import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { GraphQLError } from 'graphql'
import CheckoutReviewPage from '../CheckoutReviewPage'
import { GET_CURRENT_CART } from '../../../graphql/queries'
import { CheckoutProvider } from '../../../context/CheckoutContext'

const baseCart = {
  __typename: 'Order',
  orderId: 'order-2',
  status: 'created',
  products: [
    {
      __typename: 'OrderItem',
      product: { __typename: 'Product', id: 'product-2', title: 'Smartphone', description: 'desc', image: '/img.svg' },
      amount: 1,
      price: 899.99
    }
  ],
  deliveryAddress: {
    __typename: 'DeliveryAddress',
    recipientName: 'Jane Doe',
    phone: '+1 555 123 4567',
    country: 'USA',
    city: 'Springfield',
    street: 'Main St',
    building: '12',
    apartment: null,
    postalCode: '11111'
  },
  deliveryMethod: {
    __typename: 'DeliveryMethodSnapshot',
    type: 'extra',
    fee: 14.99,
    estimatedDays: '1-2'
  },
  // Deliberately NOT equal to subtotal + fee (899.99 + 14.99 = 914.98) to prove
  // the page renders the server value verbatim rather than recomputing it.
  total: 777.77
}

function cartMock(overrides: Partial<Record<keyof typeof baseCart, unknown>> = {}): MockedResponse {
  return {
    request: { query: GET_CURRENT_CART },
    result: { data: { currentCart: { ...baseCart, ...overrides } } }
  }
}

function renderPage(mocks: MockedResponse[], history = createMemoryHistory({ initialEntries: ['/checkout/review'] })) {
  render(
    <MockedProvider mocks={mocks}>
      <Router history={history}>
        <CheckoutProvider>
          <CheckoutReviewPage />
        </CheckoutProvider>
      </Router>
    </MockedProvider>
  )
  return history
}

describe('CheckoutReviewPage', () => {
  it('renders line items, address, method and total from currentCart (AC-301-1)', async () => {
    renderPage([cartMock()])

    expect(await screen.findByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Extra')).toBeInTheDocument()
    expect(screen.getByText('Order Total: $777.77')).toBeInTheDocument()
  })

  it('displays currentCart.total verbatim, not a client-computed subtotal + fee (AC-301-2)', async () => {
    renderPage([cartMock()])

    await screen.findByText('Smartphone')

    // Naive client math would show $914.98 (899.99 + 14.99); the mocked
    // server total is $777.77 and must be what's rendered.
    expect(screen.getByText('Order Total: $777.77')).toBeInTheDocument()
    expect(screen.queryByText(/914\.98/)).not.toBeInTheDocument()
  })

  it('clicking "Confirm and Pay" navigates to /checkout/payment and fires no mutation (AC-301-3)', async () => {
    const history = renderPage([cartMock()])

    await screen.findByText('Smartphone')
    fireEvent.click(screen.getByRole('button', { name: /confirm and pay/i }))

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/payment'))
  })

  it('redirects to /checkout/address when currentCart is null', async () => {
    const nullMock: MockedResponse = {
      request: { query: GET_CURRENT_CART },
      result: { data: { currentCart: null } }
    }
    const history = renderPage([nullMock])

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/address'))
  })

  it('redirects to /checkout/address when deliveryAddress is missing', async () => {
    const history = renderPage([cartMock({ deliveryAddress: null })])

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/address'))
  })

  it('redirects to /checkout/address when deliveryMethod is missing', async () => {
    const history = renderPage([cartMock({ deliveryMethod: null })])

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/address'))
  })

  it('renders an error banner with retry on a GraphQL error, not a crash', async () => {
    const errorMock: MockedResponse = {
      request: { query: GET_CURRENT_CART },
      result: { errors: [new GraphQLError('Test planned server error')] }
    }
    renderPage([errorMock])

    expect(await screen.findByText(/test planned server error/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
