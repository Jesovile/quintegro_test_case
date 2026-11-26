import { CheckoutRecord, OrderRecord, ProductRecord, PromoEntity } from './entities';
import { CheckoutErrorCode } from './enums';

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ProductInputDTO {
  id: string;
  amount: number;
  price: number;
}

export interface OrderSumRequestDTO {
  products: ProductInputDTO[];
  promo?: string;
}

export interface OrderItemDTO {
  product: ProductRecord;
  amount: number;
  price: number;
}

export interface OrderDTO {
  orderId: string;
  status: OrderRecord['status'];
  products: OrderItemDTO[];
  promo?: PromoEntity;
  checkout?: CheckoutRecord;
}

export interface CustomerInfoDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
}

// Request-only data. Never include this DTO in a repository or response.
export interface CreditCardDTO {
  cardholderName: string;
  number: string;
  expiryMonth: number;
  expiryYear: number;
  securityCode: string;
}

export interface CheckoutInput {
  customer: CustomerInfoDTO;
  creditCard: CreditCardDTO;
}

export interface SubmitOrderArgsDTO {
  orderId: string;
  input: CheckoutInput;
}

export interface PaymentRequestDTO {
  orderId: string;
  idempotencyKey: string;
  amount: number; // Integer minor units; passed to the bank, never stored locally.
  currency: 'USD';
  creditCard: CreditCardDTO;
}

export interface PaymentApprovalDTO {
  status: 'approved';
  paymentId: string;
  provider: string;
}

export type AcquiringResultDTO = PaymentApprovalDTO
  | { status: 'declined' } | { status: 'provider_error' };

export interface SubmitOrderSuccessDTO {
  success: true;
  code: 'APPROVED';
  message: string;
  orderId: string;
  paymentId: string;
  paymentProvider: string;
}

export interface SubmitOrderFailureDTO {
  success: false;
  code: CheckoutErrorCode;
  message: string;
  orderId: string;
}

export type SubmitOrderResult = SubmitOrderSuccessDTO | SubmitOrderFailureDTO;
