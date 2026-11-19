export type CardDetails = {
  number: string
  holderName: string
  expiryMonth: number
  expiryYear: number
  cvv: string
}

export type PaymentRequest = {
  orderId: string
  amount: number
  currency: string
  card: CardDetails
}

export type PaymentResult = {
  providerPaymentId: string
  status: 'succeeded'
  paidAt: string
}

export interface PaymentGateway {
  pay(request: PaymentRequest): Promise<PaymentResult>
}
