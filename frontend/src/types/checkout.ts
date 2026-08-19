export interface Address {
  fullName: string
  country: string
  city: string
  street: string
  postalCode: string
  phone: string
}

export interface DeliveryOption {
  id: string
  provider: string
  title: string
  price: number
  etaDays: number
  description: string
}

export type PaymentMethod = 'card' | 'paypal'

export interface ReserveItemIssue {
  productId: string
  productTitle: string
  requested: number
  available: number
}

export type ReserveErrorCode = 'INSUFFICIENT_STOCK' | 'DELIVERY_OPTION_INVALID' | 'INVALID_STATUS'

export interface ReserveResult {
  success: boolean
  reservedUntil?: number
  issues?: ReserveItemIssue[]
  errorCode?: ReserveErrorCode
}

export type PaymentErrorCode =
  | 'DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'GATEWAY_UNAVAILABLE'
  | 'RESERVATION_EXPIRED'
  | 'INVALID_STATUS'

export interface PaymentResult {
  success: boolean
  transactionId?: string
  errorCode?: PaymentErrorCode
  errorMessage?: string
}

export interface CardPaymentInput {
  cardNumber: string
  cardHolder: string
  expiryMonth: number
  expiryYear: number
  cvv: string
}

export interface PaypalPaymentInput {
  email: string
}
