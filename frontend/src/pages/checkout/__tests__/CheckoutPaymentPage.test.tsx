import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { GraphQLError } from 'graphql'
import CheckoutPaymentPage from '../CheckoutPaymentPage'
import { GET_CURRENT_CART } from '../../../graphql/queries'
import { PAY } from '../../../graphql/mutations'
import { CheckoutProvider } from '../../../context/CheckoutContext'

const VALID_CARD = {
  cardNumber: '4242424242424242',
  expiry: '09/30',
  cvv: '123',
  cardholderName: 'Jane Doe'
}

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
  deliveryAddress: null,
  deliveryMethod: null,
  total: 899.99
}

function cartMock(overrides: Partial<typeof baseCart> = {}): MockedResponse {
  return {
    request: { query: GET_CURRENT_CART },
    result: { data: { currentCart: { ...baseCart, ...overrides } } }
  }
}

function fillCard() {
  fireEvent.change(screen.getByLabelText(/card number/i), { target: { value: VALID_CARD.cardNumber } })
  fireEvent.change(screen.getByLabelText(/expiry/i), { target: { value: VALID_CARD.expiry } })
  fireEvent.change(screen.getByLabelText(/cvv/i), { target: { value: VALID_CARD.cvv } })
  fireEvent.change(screen.getByLabelText(/cardholder name/i), { target: { value: VALID_CARD.cardholderName } })
}

function renderPage(mocks: MockedResponse[], history = createMemoryHistory({ initialEntries: ['/checkout/payment'] })) {
  render(
    <MockedProvider mocks={mocks}>
      <Router history={history}>
        <CheckoutProvider>
          <CheckoutPaymentPage />
        </CheckoutProvider>
      </Router>
    </MockedProvider>
  )
  return history
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CheckoutPaymentPage', () => {
  it('redirects to /checkout/confirmation/:orderId without rendering PaymentForm for an order already status: paid (regression test)', async () => {
    const history = renderPage([cartMock({ status: 'paid' })])

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/confirmation/order-2'))
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument()
  })

  it('redirects to /checkout/address (not a blank page) when currentCart is null and no orderId is known yet (regression test)', async () => {
    const nullMock: MockedResponse = {
      request: { query: GET_CURRENT_CART },
      result: { data: { currentCart: null } }
    }
    const history = renderPage([nullMock])

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/address'))
  })

  it("renders PaymentForm in the entering state for a status: 'created' order", async () => {
    renderPage([cartMock()])

    expect(await screen.findByLabelText(/card number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()
  })

  it('submitting a valid, non-magic card transitions through processing (button disabled, spinner) to navigation toward confirmation (AC-402-1, AC-403-1)', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('idem-key-1' as `${string}-${string}-${string}-${string}-${string}`)

    const payMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'idem-key-1', card: VALID_CARD } },
      result: {
        data: {
          pay: {
            order: { orderId: 'order-2', status: 'paid' },
            payment: { paymentId: 'payment-1', status: 'succeeded', cardLast4: '4242', cardholderName: 'Jane Doe', failureReason: null, createdAt: 1 }
          }
        }
      }
    }

    const history = renderPage([cartMock(), payMock])

    await screen.findByLabelText(/card number/i)
    fillCard()
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(screen.getByText(/processing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled()

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/confirmation/order-2'))
  })

  it('submitting the magic decline card number renders the failure banner, does not navigate, and a subsequent submit is possible (AC-404-1, AC-404-4)', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('idem-key-1' as `${string}-${string}-${string}-${string}-${string}`)

    const declineCard = { ...VALID_CARD, cardNumber: '4000000000000002' }
    const declineMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'idem-key-1', card: declineCard } },
      result: {
        data: {
          pay: {
            order: { orderId: 'order-2', status: 'created' },
            payment: { paymentId: 'payment-1', status: 'failed', cardLast4: '0002', cardholderName: 'Jane Doe', failureReason: 'Card declined by issuer (mock)', createdAt: 1 }
          }
        }
      }
    }

    const history = renderPage([cartMock(), declineMock])

    await screen.findByLabelText(/card number/i)
    fireEvent.change(screen.getByLabelText(/card number/i), { target: { value: declineCard.cardNumber } })
    fireEvent.change(screen.getByLabelText(/expiry/i), { target: { value: declineCard.expiry } })
    fireEvent.change(screen.getByLabelText(/cvv/i), { target: { value: declineCard.cvv } })
    fireEvent.change(screen.getByLabelText(/cardholder name/i), { target: { value: declineCard.cardholderName } })
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(await screen.findByText(/card declined by issuer/i)).toBeInTheDocument()
    expect(history.location.pathname).toBe('/checkout/payment')
    expect(screen.getByRole('button', { name: /^pay$/i })).toBeEnabled()
  })

  it('simulating an Apollo network error during submit renders the same failure banner markup as the declined-card case (AC-404-5)', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('idem-key-1' as `${string}-${string}-${string}-${string}-${string}`)

    const errorMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'idem-key-1', card: VALID_CARD } },
      result: { errors: [new GraphQLError('Test planned server error')] }
    }

    renderPage([cartMock(), errorMock])

    await screen.findByLabelText(/card number/i)
    fillCard()
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(await screen.findByText(/something went wrong processing your payment/i)).toBeInTheDocument()
  })
})
