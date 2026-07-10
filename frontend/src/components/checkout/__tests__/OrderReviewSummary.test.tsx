import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderReviewSummary, { OrderReviewProduct } from '../OrderReviewSummary'
import { DeliveryAddress } from '../../../context/CheckoutContext'

const products: OrderReviewProduct[] = [
  { product: { id: 'product-2', title: 'Smartphone', image: '/img.svg' }, amount: 1, price: 899.99 },
  { product: { id: 'product-4', title: 'Headphones', image: '/img2.svg' }, amount: 2, price: 599.99 }
]

const address: DeliveryAddress = {
  recipientName: 'Jane Doe',
  phone: '+1 555 123 4567',
  country: 'USA',
  city: 'Springfield',
  street: 'Main St',
  building: '12',
  apartment: '4B',
  postalCode: '11111'
}

const deliveryMethod = { type: 'extra' as const, fee: 14.99, estimatedDays: '1-2' }

describe('OrderReviewSummary', () => {
  it('renders all line items with correct title/amount/price', () => {
    render(<OrderReviewSummary products={products} deliveryAddress={address} deliveryMethod={deliveryMethod} total={1514.97} />)

    expect(screen.getByText('Smartphone')).toBeInTheDocument()
    expect(screen.getByText('Qty: 1')).toBeInTheDocument()
    expect(screen.getByText('$899.99')).toBeInTheDocument()

    expect(screen.getByText('Headphones')).toBeInTheDocument()
    expect(screen.getByText('Qty: 2')).toBeInTheDocument()
    expect(screen.getByText('$599.99')).toBeInTheDocument()
  })

  it('renders delivery address fields (recipient name, full address line, phone)', () => {
    render(<OrderReviewSummary products={products} deliveryAddress={address} deliveryMethod={deliveryMethod} total={1514.97} />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('+1 555 123 4567')).toBeInTheDocument()
    expect(screen.getByText(/Main St 12, apt 4B/)).toBeInTheDocument()
    expect(screen.getByText(/Springfield, USA 11111/)).toBeInTheDocument()
  })

  it("renders delivery method label, fee, and estimated days matching AC-202-1's display format", () => {
    render(<OrderReviewSummary products={products} deliveryAddress={address} deliveryMethod={deliveryMethod} total={1514.97} />)

    expect(screen.getByText('Extra')).toBeInTheDocument()
    expect(screen.getByText('1-2 days')).toBeInTheDocument()
    expect(screen.getByText('$14.99')).toBeInTheDocument()
  })

  it('renders the total prop formatted via formatCurrency with no arithmetic performed inside the component', () => {
    // Deliberately does NOT equal subtotal + fee (899.99 + 2*599.99 + 14.99 = 2114.96)
    // to prove there's no shadow client-side recomputation.
    const deliberatelyWrongTotal = 1.23
    render(<OrderReviewSummary products={products} deliveryAddress={address} deliveryMethod={deliveryMethod} total={deliberatelyWrongTotal} />)

    expect(screen.getByText('Order Total: $1.23')).toBeInTheDocument()
  })
})
