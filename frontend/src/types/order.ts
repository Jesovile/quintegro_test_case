export type OrderStatus =
  | 'created'
  | 'checkout'
  | 'submited'
  | 'finished'
  | 'canceled'

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

export interface Shipping {
  fullName: string
  address: string
  city: string
  zip: string
  country: string
  phone: string
}

export interface Payment {
  brand: string
  last4: string
  holderName: string
}

export interface Order {
  orderId: string
  status: OrderStatus
  createAt: number
  placedAt?: number | null
  canceledAt?: number | null
  products: OrderItem[]
  shipping?: Shipping | null
  payment?: Payment | null
}

export const CURRENT_STATUSES: OrderStatus[] = ['created', 'checkout']
export const HISTORY_STATUSES: OrderStatus[] = ['submited', 'finished', 'canceled']

export const isCurrent = (o: Order) => CURRENT_STATUSES.includes(o.status)
export const isHistory = (o: Order) => HISTORY_STATUSES.includes(o.status)
