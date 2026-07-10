import React, { useEffect, useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { GraphQLError } from 'graphql'
import CheckoutAddressPage from '../CheckoutAddressPage'
import { GET_CURRENT_CART, GET_DELIVERY_METHODS } from '../../../graphql/queries'
import { SUBMIT_DELIVERY_DETAILS } from '../../../graphql/mutations'
import { CheckoutProvider, useCheckout, DeliveryAddress } from '../../../context/CheckoutContext'

const cartWithItems = {
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
  deliveryMethod: null
}

const deliveryMethodOptions = [
  { __typename: 'DeliveryMethodOption', type: 'regular', label: 'Regular', fee: 5.99, estimatedDays: '3-5' },
  { __typename: 'DeliveryMethodOption', type: 'extra', label: 'Extra', fee: 14.99, estimatedDays: '1-2' }
]

const cartMock: MockedResponse = {
  request: { query: GET_CURRENT_CART },
  result: { data: { currentCart: cartWithItems } }
}

const methodsMock: MockedResponse = {
  request: { query: GET_DELIVERY_METHODS },
  result: { data: { deliveryMethods: deliveryMethodOptions } }
}

const validAddress: DeliveryAddress = {
  recipientName: 'Jane Doe',
  phone: '+1 555 123 4567',
  country: 'USA',
  city: 'Springfield',
  street: 'Main St',
  building: '12',
  apartment: '',
  postalCode: '11111'
}

function fillAddress(overrides: Partial<DeliveryAddress> = {}) {
  const address = { ...validAddress, ...overrides }
  fireEvent.change(screen.getByLabelText(/recipient full name/i), { target: { value: address.recipientName } })
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: address.phone } })
  fireEvent.change(screen.getByLabelText(/^country/i), { target: { value: address.country } })
  fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: address.city } })
  fireEvent.change(screen.getByLabelText(/^street/i), { target: { value: address.street } })
  fireEvent.change(screen.getByLabelText(/^building/i), { target: { value: address.building } })
  fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: address.postalCode } })
}

// Pre-seeds CheckoutContext (orderId + address + deliveryMethodType) before
// CheckoutAddressPage ever mounts, simulating "user navigated back from
// /checkout/review" for AC-201-5.
const Seeder: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { dispatch } = useCheckout()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    dispatch({ type: 'SET_ORDER_ID', orderId: 'order-2' })
    dispatch({ type: 'SET_DELIVERY', address: validAddress, deliveryMethodType: 'extra' })
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ready ? <>{children}</> : null
}

function renderPage(mocks: MockedResponse[], history = createMemoryHistory()) {
  render(
    <MockedProvider mocks={mocks}>
      <Router history={history}>
        <CheckoutProvider>
          <CheckoutAddressPage />
        </CheckoutProvider>
      </Router>
    </MockedProvider>
  )
  return history
}

describe('CheckoutAddressPage', () => {
  it('disables submit when no delivery method is selected, even with a fully valid address (AC-202-2)', async () => {
    renderPage([cartMock, methodsMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Regular')

    fillAddress()

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeDisabled()
  })

  it.each([
    ['recipientName', /recipient full name/i],
    ['phone', /phone number/i],
    ['country', /^country/i],
    ['city', /^city/i],
    ['street', /^street/i],
    ['building', /^building/i],
    ['postalCode', /postal code/i]
  ])('disables submit when required field %s is empty (AC-201-2)', async (field) => {
    renderPage([cartMock, methodsMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Extra')

    fillAddress({ [field]: '' } as Partial<DeliveryAddress>)
    fireEvent.click(screen.getByText('Extra'))
    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }))

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeDisabled()
  })

  it('enables submit when apartment is left empty but everything else is valid', async () => {
    renderPage([cartMock, methodsMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Regular')

    fillAddress()
    fireEvent.click(screen.getByText('Regular'))

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
  })

  it.each([['abc'], ['123']])('disables submit for a malformed phone %s (AC-201-3)', async (badPhone) => {
    renderPage([cartMock, methodsMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Regular')

    fillAddress({ phone: badPhone })
    fireEvent.click(screen.getByText('Regular'))
    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }))

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeDisabled()
    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument()
  })

  it('enables submit for a well-formed phone', async () => {
    renderPage([cartMock, methodsMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Regular')

    fillAddress()
    fireEvent.click(screen.getByText('Regular'))

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
  })

  it('fires SUBMIT_DELIVERY_DETAILS with the exact address + method, then navigates to /checkout/review on success', async () => {
    let capturedVariables: Record<string, unknown> | null = null
    const submitMock: MockedResponse = {
      request: {
        query: SUBMIT_DELIVERY_DETAILS,
        variables: { orderId: 'order-2', address: validAddress, deliveryMethodType: 'extra' }
      },
      result: () => {
        capturedVariables = { orderId: 'order-2', address: validAddress, deliveryMethodType: 'extra' }
        return {
          data: {
            submitDeliveryDetails: {
              __typename: 'Order',
              orderId: 'order-2',
              deliveryAddress: { __typename: 'DeliveryAddress', ...validAddress },
              deliveryMethod: { __typename: 'DeliveryMethodSnapshot', type: 'extra', fee: 14.99, estimatedDays: '1-2' }
            }
          }
        }
      }
    }

    const history = renderPage([cartMock, methodsMock, submitMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Extra')

    fillAddress()
    fireEvent.click(screen.getByText('Extra'))
    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }))

    await waitFor(() => expect(history.location.pathname).toBe('/checkout/review'))
    expect(capturedVariables).toEqual({ orderId: 'order-2', address: validAddress, deliveryMethodType: 'extra' })
  })

  it('renders an error banner and does not navigate when the mutation fails', async () => {
    const errorMock: MockedResponse = {
      request: {
        query: SUBMIT_DELIVERY_DETAILS,
        variables: { orderId: 'order-2', address: validAddress, deliveryMethodType: 'regular' }
      },
      result: {
        errors: [new GraphQLError('Order not found or access denied')]
      }
    }

    const history = renderPage([cartMock, methodsMock, errorMock])

    await screen.findByText(/cart found/i)
    await screen.findByText('Regular')

    fillAddress()
    fireEvent.click(screen.getByText('Regular'))
    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }))

    expect(await screen.findByText(/order not found or access denied/i)).toBeInTheDocument()
    expect(history.location.pathname).not.toBe('/checkout/review')
  })

  it('pre-fills address fields and method selection from CheckoutContext on back-navigation (AC-201-5)', async () => {
    render(
      <MockedProvider mocks={[cartMock, methodsMock]}>
        <Router history={createMemoryHistory()}>
          <CheckoutProvider>
            <Seeder>
              <CheckoutAddressPage />
            </Seeder>
          </CheckoutProvider>
        </Router>
      </MockedProvider>
    )

    await screen.findByText(/cart found/i)
    await screen.findByText('Extra')

    expect((screen.getByLabelText(/recipient full name/i) as HTMLInputElement).value).toBe(validAddress.recipientName)
    expect((screen.getByLabelText(/^city/i) as HTMLInputElement).value).toBe(validAddress.city)
    expect(screen.getByText('Extra').closest('button')).toHaveAttribute('aria-checked', 'true')
  })
})
