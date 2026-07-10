import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderHistoryItem, { OrderHistoryOrder } from '../OrderHistoryItem'

const paidOrder: OrderHistoryOrder = {
  orderId: 'order-2',
  status: 'paid',
  products: [
    {
      product: { id: 'product-2', title: 'Smartphone', description: 'A phone', image: '/img.svg' },
      amount: 1,
      price: 899.99
    }
  ],
  deliveryAddress: {
    recipientName: 'Jane Doe',
    phone: '+1 555 123 4567',
    country: 'USA',
    city: 'Springfield',
    street: 'Main St',
    building: '12',
    apartment: '4B',
    postalCode: '11111'
  },
  deliveryMethod: { type: 'extra', fee: 14.99, estimatedDays: '1-2' },
  payment: {
    paymentId: 'payment-1',
    status: 'succeeded',
    cardLast4: '4242',
    cardholderName: 'Jane Doe',
    createdAt: 1
  },
  total: 914.98
}

describe('OrderHistoryItem', () => {
  it('renders no quantity +/- controls and no delete button for a paid order (iteration 5.2 done criteria)', () => {
    render(<OrderHistoryItem order={paidOrder} />)

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    // No buttons at all (no +/-, no trash-icon delete, no Cancel Order yet —
    // that's Feature 6's addition on top of this component).
    expect(document.querySelectorAll('button')).toHaveLength(0)
  })

  it('renders a "Paid" status badge for a paid order', () => {
    render(<OrderHistoryItem order={paidOrder} />)
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Paid')
  })

  it('renders a "Cancelled" status badge for a cancelled order', () => {
    render(<OrderHistoryItem order={{ ...paidOrder, status: 'cancelled' }} />)
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Cancelled')
  })

  it('AC-503-1: renders items, delivery address, delivery method + fee, payment status, and total for a fully-populated order', () => {
    render(<OrderHistoryItem order={paidOrder} />)

    expect(screen.getByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Extra')).toBeInTheDocument()
    expect(screen.getByText(/1-2/)).toBeInTheDocument()
    expect(screen.getByText(/\$14\.99/)).toBeInTheDocument()
    expect(screen.getByText('Total: $914.98')).toBeInTheDocument()
    // Payment status block renders "Paid" (mapped from payment.status === 'succeeded').
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0)
  })

  it('renders without throwing when deliveryAddress/deliveryMethod/payment/total are all missing (legacy order-1 style)', () => {
    const legacyOrder: OrderHistoryOrder = {
      orderId: 'order-1',
      status: 'finished',
      products: paidOrder.products,
      deliveryAddress: null,
      deliveryMethod: null,
      payment: null
    }

    expect(() => render(<OrderHistoryItem order={legacyOrder} />)).not.toThrow()
    expect(screen.getByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Finished')
  })

  it('accepts onCancel/cancelling/cancelError props without using them (Feature 6 extension point, plan-review N1 pinned contract)', () => {
    expect(() =>
      render(
        <OrderHistoryItem
          order={paidOrder}
          onCancel={() => {}}
          cancelling={true}
          cancelError="some error"
        />
      )
    ).not.toThrow()
  })

  describe('Feature 6 — order cancellation (US-601)', () => {
    it('AC-601-1: renders a "Cancel Order" button for a paid order when onCancel is provided', () => {
      render(<OrderHistoryItem order={paidOrder} onCancel={() => {}} />)
      expect(screen.getByRole('button', { name: 'Cancel Order' })).toBeInTheDocument()
    })

    it('does not render a "Cancel Order" button when onCancel is not provided (back-compat, pre-Feature-6 contract)', () => {
      render(<OrderHistoryItem order={paidOrder} />)
      expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument()
    })

    it('AC-601-3: renders no "Cancel Order" action for a cancelled order', () => {
      render(<OrderHistoryItem order={{ ...paidOrder, status: 'cancelled' }} onCancel={() => {}} />)
      expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument()
    })

    it('clicking "Cancel Order" calls onCancel(orderId) immediately with no confirmation dialog/modal', async () => {
      const onCancel = vi.fn()
      const confirmSpy = vi.spyOn(window, 'confirm')

      render(<OrderHistoryItem order={paidOrder} onCancel={onCancel} />)
      await userEvent.click(screen.getByRole('button', { name: 'Cancel Order' }))

      expect(onCancel).toHaveBeenCalledWith('order-2')
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(confirmSpy).not.toHaveBeenCalled()
      // No dialog/modal element rendered anywhere (ARIA role or native <dialog>).
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.querySelector('dialog')).not.toBeInTheDocument()

      confirmSpy.mockRestore()
    })

    it('disables the "Cancel Order" button while cancelling is true (no double-submit)', () => {
      render(<OrderHistoryItem order={paidOrder} onCancel={() => {}} cancelling={true} />)
      expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeDisabled()
    })

    it('AC-601-4: shows cancelError inline without changing the displayed status', () => {
      render(
        <OrderHistoryItem order={paidOrder} onCancel={() => {}} cancelError="Order cannot be cancelled in its current status" />
      )
      expect(screen.getByText('Order cannot be cancelled in its current status')).toBeInTheDocument()
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Paid')
    })
  })
})
