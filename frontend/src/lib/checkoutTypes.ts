export interface Product {
  id: string
  title: string
  description: string
  image: string
}

export interface OrderItem {
  product: Product
  amount: number
  price: number
}

export interface CheckoutSnapshot {
  submittedAt: number
  quote: {
    id: string
    fingerprint: string
    subtotalMinor: number
    discountMinor: number
    deliveryFeeMinor: number
    totalMinor: number
    currency: string
    deliveryQuoteId: string
    expiresAt: number
  }
  payment: { status: string; reference: string; brand: string; last4: string }
  delivery: { quoteId: string; reference: string; method: 'standard' | 'express'; feeMinor: number; estimatedDeliveryAt: number }
}

export interface Order {
  orderId: string
  status: 'created' | 'submited' | 'finished'
  products: OrderItem[]
  checkout?: CheckoutSnapshot
}

export interface DeliveryAddress {
  fullName: string
  street: string
  city: string
  postalCode: string
  country: string
}

export interface CheckoutQuote {
  id: string
  fingerprint: string
  subtotalMinor: number
  discountMinor: number
  deliveryFeeMinor: number
  totalMinor: number
  currency: string
  deliveryQuoteId: string
  expiresAt: number
}
