export type PaymentMethodType = 'card' | 'paypal';

export interface CardDetails {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

export interface PaypalDetails {
  email: string;
}

export interface ChargeRequest {
  amount: number;
  method: PaymentMethodType;
  card?: CardDetails;
  paypal?: PaypalDetails;
}

export type PaymentErrorCode =
  | 'DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'GATEWAY_UNAVAILABLE';

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  errorCode?: PaymentErrorCode;
  errorMessage?: string;
}

export interface IPaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
