export type OrderStatus = 'created' | 'checkout' | 'paid' | 'processing' | 'deliver' | 'cancelled'

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

export interface Promo {
  id: string
  discount: number
  dueDate: number
}

export interface OrderTotals {
  subtotal: number
  discount: number
  total: number
  currency: 'USD'
}

export interface Order {
  orderId: string
  status: OrderStatus
  products: OrderItem[]
  promo: Promo | null
  totals: OrderTotals
}

export type CheckoutStep = 'delivery' | 'payment' | 'processing' | 'success'
