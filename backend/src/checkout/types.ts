export type DeliveryMethod = 'standard' | 'express';
export type CheckoutAttemptState =
  | 'processing'
  | 'payment_failed'
  | 'action_required'
  | 'payment_authorized'
  | 'delivery_scheduled'
  | 'compensation_required'
  | 'completed';

export interface DeliveryAddress {
  fullName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface CheckoutLineInput {
  productId: string;
  quantity: number;
}

export interface CheckoutQuoteInput {
  orderId: string;
  products: CheckoutLineInput[];
  promoCode?: string;
  deliveryAddress: DeliveryAddress;
  deliveryMethod: DeliveryMethod;
}

export interface CheckoutQuote {
  id: string;
  fingerprint: string;
  subtotalMinor: number;
  discountMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: 'USD';
  deliveryQuoteId: string;
  expiresAt: number;
  input: CheckoutQuoteInput;
}

export interface PaymentMethodInput {
  token: string;
  brand: string;
  last4: string;
}

export interface SubmitOrderInput {
  orderId: string;
  attemptId: string;
  quoteId: string;
  quoteFingerprint: string;
  expectedTotalMinor: number;
  paymentMethod: PaymentMethodInput;
}

export interface PaymentAuthorizationInput {
  amountMinor: number;
  currency: 'USD';
  paymentMethodToken: string;
  idempotencyKey: string;
}

export interface PaymentAuthorization {
  status: 'authorized' | 'requires_action' | 'declined' | 'unavailable';
  reference?: string;
  errorCode?: string;
}

export interface PaymentCaptureInput {
  authorizationReference: string;
  amountMinor: number;
  currency: 'USD';
  idempotencyKey: string;
}

export interface PaymentCapture {
  status: 'captured' | 'unavailable';
  reference?: string;
  errorCode?: string;
}

export interface PaymentVoidInput {
  authorizationReference: string;
  idempotencyKey: string;
}

export interface DeliveryQuoteInput {
  address: DeliveryAddress;
  method: DeliveryMethod;
  currency: 'USD';
}

export interface DeliveryQuote {
  id: string;
  feeMinor: number;
  currency: 'USD';
  expiresAt: number;
  estimatedDeliveryAt: number;
}

export interface DeliveryScheduleInput {
  quoteId: string;
  address: DeliveryAddress;
  idempotencyKey: string;
}

export interface ScheduledDelivery {
  reference: string;
  estimatedDeliveryAt: number;
}

export interface DeliveryCancelInput {
  deliveryReference: string;
  idempotencyKey: string;
}

export interface CheckoutPaymentSnapshot {
  status: 'authorized' | 'captured';
  reference: string;
  brand: string;
  last4: string;
}

export interface CheckoutDeliverySnapshot {
  quoteId: string;
  reference: string;
  method: DeliveryMethod;
  feeMinor: number;
  estimatedDeliveryAt: number;
}

export interface CheckoutSnapshot {
  quote: Omit<CheckoutQuote, 'input'>;
  payment: CheckoutPaymentSnapshot;
  delivery: CheckoutDeliverySnapshot;
  submittedAt: number;
}

export interface CheckoutAttempt {
  attemptId: string;
  orderId: string;
  userId: string;
  quoteId: string;
  fingerprint: string;
  state: CheckoutAttemptState;
  payment?: CheckoutPaymentSnapshot;
  delivery?: CheckoutDeliverySnapshot;
  errorCode?: string;
  result?: SubmitOrderPayload;
}

export interface SubmitOrderPayload {
  status: CheckoutAttemptState;
  orderId: string;
  checkout?: CheckoutSnapshot;
  paymentReference?: string;
  deliveryReference?: string;
  errorCode?: string;
}
