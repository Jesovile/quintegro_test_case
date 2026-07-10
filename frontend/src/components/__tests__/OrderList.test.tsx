import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import OrderList from '../OrderList'
import { GET_ORDERS } from '../../graphql/queries'
import { CANCEL_ORDER } from '../../graphql/mutations'

function product(id: string, title: string) {
  return { __typename: 'Product', id, title, description: 'desc', image: '/img.svg' }
}

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'Order',
    orderId: 'order-x',
    status: 'created',
    createAt: Date.now(),
    products: [
      { __typename: 'OrderItem', product: product('product-2', 'Smartphone'), amount: 1, price: 899.99 }
    ],
    promo: null,
    deliveryAddress: null,
    deliveryMethod: null,
    payment: null,
    total: 899.99,
    ...overrides
  }
}

function mockOrders(orders: ReturnType<typeof orderFixture>[]): MockedResponse[] {
  return [
    {
      request: { query: GET_ORDERS },
      result: { data: { orders } }
    }
  ]
}

describe('OrderList', () => {
  it('renders one OrderListItem (editable) for a created order and one OrderHistoryItem (read-only) for a paid order', async () => {
    const orders = [
      orderFixture({ orderId: 'order-created', status: 'created', createAt: 1000 }),
      orderFixture({ orderId: 'order-paid', status: 'paid', createAt: 2000, products: [
        { __typename: 'OrderItem', product: product('product-4', 'Tablet'), amount: 2, price: 599.99 }
      ] })
    ]

    render(
      <MockedProvider mocks={mockOrders(orders)}>
        <OrderList />
      </MockedProvider>
    )

    expect(await screen.findByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByText('Tablet')).toBeInTheDocument()

    // OrderListItem renders quantity +/- controls (spinbutton input); OrderHistoryItem does not.
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)

    // The paid order renders via OrderHistoryItem's status badge.
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Paid')

    // The created order is labeled "Cart", not a payment-status badge (AC-503-2).
    expect(screen.getByText(/Order #order-created - Cart/)).toBeInTheDocument()
  })

  it('AC-503-3: renders orders most-recent-first regardless of the order the API returned them in', async () => {
    const orders = [
      orderFixture({ orderId: 'order-oldest', status: 'paid', createAt: 1000 }),
      orderFixture({ orderId: 'order-newest', status: 'paid', createAt: 3000 }),
      orderFixture({ orderId: 'order-middle', status: 'paid', createAt: 2000 })
    ]

    render(
      <MockedProvider mocks={mockOrders(orders)}>
        <OrderList />
      </MockedProvider>
    )

    await screen.findByText(/Order #order-newest/)

    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(headings).toEqual([
      expect.stringContaining('order-newest'),
      expect.stringContaining('order-middle'),
      expect.stringContaining('order-oldest')
    ])
  })

  describe('Feature 6 — order cancellation (US-601), OrderList owns the mutation', () => {
    it('AC-601-2: on a successful cancelOrder, updates the order status to "Cancelled" and hides the button', async () => {
      const orders = [orderFixture({ orderId: 'order-paid', status: 'paid' })]

      const mocks: MockedResponse[] = [
        { request: { query: GET_ORDERS }, result: { data: { orders } } },
        {
          request: { query: CANCEL_ORDER, variables: { orderId: 'order-paid' } },
          result: { data: { cancelOrder: { orderId: 'order-paid', status: 'cancelled', __typename: 'Order' } } }
        }
      ]

      render(
        <MockedProvider mocks={mocks}>
          <OrderList />
        </MockedProvider>
      )

      const cancelButton = await screen.findByRole('button', { name: 'Cancel Order' })
      await userEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Cancelled')
      })
      expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument()
    })

    it('AC-601-4: on a failed cancelOrder, shows the error and leaves the displayed status unchanged', async () => {
      const orders = [orderFixture({ orderId: 'order-paid', status: 'paid' })]

      const mocks: MockedResponse[] = [
        { request: { query: GET_ORDERS }, result: { data: { orders } } },
        {
          request: { query: CANCEL_ORDER, variables: { orderId: 'order-paid' } },
          error: new Error('Order cannot be cancelled in its current status')
        }
      ]

      render(
        <MockedProvider mocks={mocks}>
          <OrderList />
        </MockedProvider>
      )

      const cancelButton = await screen.findByRole('button', { name: 'Cancel Order' })
      await userEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.getByText(/Order cannot be cancelled in its current status/)).toBeInTheDocument()
      })
      // Status is unchanged — button is still shown, badge still says "Paid".
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Paid')
      expect(screen.getByRole('button', { name: 'Cancel Order' })).toBeInTheDocument()
    })

    it('iteration 6.5: a network/500 error on cancelOrder surfaces the same inline error-banner treatment, no unhandled rejection or blank screen', async () => {
      const orders = [orderFixture({ orderId: 'order-paid', status: 'paid' })]

      const mocks: MockedResponse[] = [
        { request: { query: GET_ORDERS }, result: { data: { orders } } },
        {
          request: { query: CANCEL_ORDER, variables: { orderId: 'order-paid' } },
          error: new Error('Failed to fetch')
        }
      ]

      render(
        <MockedProvider mocks={mocks}>
          <OrderList />
        </MockedProvider>
      )

      const cancelButton = await screen.findByRole('button', { name: 'Cancel Order' })
      await userEvent.click(cancelButton)

      // Same inline treatment as a business-logic rejection (role="alert" text),
      // order status stays visibly unchanged, button remains for retry.
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch')
      })
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Paid')
      expect(screen.getByRole('button', { name: 'Cancel Order' })).toBeInTheDocument()
    })

    it('AC-601-3: a cancelled order renders no "Cancel Order" action', async () => {
      const orders = [orderFixture({ orderId: 'order-cancelled', status: 'cancelled' })]

      render(
        <MockedProvider mocks={mockOrders(orders)}>
          <OrderList />
        </MockedProvider>
      )

      await screen.findByTestId('order-status-badge')
      expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument()
    })
  })
})
