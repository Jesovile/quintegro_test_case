import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { Router, Route } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import CheckoutConfirmationPage from '../CheckoutConfirmationPage'
import { GET_ORDER } from '../../../graphql/queries'

const paidOrder = {
  __typename: 'Order',
  orderId: 'order-2',
  status: 'paid',
  createAt: 1000,
  products: [
    {
      __typename: 'OrderItem',
      product: { __typename: 'Product', id: 'product-2', title: 'Smartphone', description: 'desc', image: '/img.svg' },
      amount: 1,
      price: 899.99
    }
  ],
  promo: null,
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
  deliveryMethod: { __typename: 'DeliveryMethodSnapshot', type: 'regular', fee: 5.99, estimatedDays: '3-5' },
  payment: {
    __typename: 'PaymentSummary',
    paymentId: 'payment-1',
    status: 'succeeded',
    cardLast4: '4242',
    cardholderName: 'Jane Doe',
    failureReason: null,
    createdAt: 1
  },
  total: 905.98
}

function orderMock(order: Record<string, unknown> | null): MockedResponse {
  return {
    request: { query: GET_ORDER, variables: { orderId: 'order-2' } },
    result: { data: { order } }
  }
}

function renderPage(mocks: MockedResponse[]) {
  const history = createMemoryHistory({ initialEntries: ['/checkout/confirmation/order-2'] })
  render(
    <MockedProvider mocks={mocks}>
      <Router history={history}>
        <Route path="/checkout/confirmation/:orderId" component={CheckoutConfirmationPage} />
      </Router>
    </MockedProvider>
  )
  return history
}

describe('CheckoutConfirmationPage', () => {
  it('AC-501-1: renders order id, item list, delivery address, delivery method, and total for a paid order', async () => {
    renderPage([orderMock(paidOrder)])

    expect(await screen.findByText(/Order #order-2/)).toBeInTheDocument()
    expect(screen.getByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Regular')).toBeInTheDocument()
    expect(screen.getByText(/Order Total: \$905\.98/)).toBeInTheDocument()
  })

  it('AC-501-2: clicking "My Orders" navigates to /order', async () => {
    const history = renderPage([orderMock(paidOrder)])

    const link = await screen.findByRole('button', { name: /my orders/i })
    link.click()

    expect(history.location.pathname).toBe('/order')
  })

  it('renders the redirect-guard message instead of confirmation content for an order that is not yet paid', async () => {
    renderPage([orderMock({ ...paidOrder, status: 'created' })])

    expect(await screen.findByText(/isn't confirmed yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Smartphone')).not.toBeInTheDocument()
  })
})
