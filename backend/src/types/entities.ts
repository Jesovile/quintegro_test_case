export interface UserRecord {
  id: string;
  name: string;
}

export interface AuthRecord {
  userId: string;
  login: string;
  password: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  image: string;
}

export type OrderStatus = 'created' | 'submited' | 'waiting_payment' | 'finished';

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createAt: number;
  products: Array<{
    id: string;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
}

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  products: Array<{
    product: ProductRecord;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}

export interface DeliveryDetails {
  postalCode: string;
  street: string;
  city: string;
}

export interface PaymentDetails {
  method: 'card' | 'paypal';
  cardNumber?: string;
  cardholderName?: string;
  expiryDate?: string;
  cvv?: string;
  paypalEmail?: string;
}

export interface CheckoutInput {
  delivery: DeliveryDetails;
  payment: PaymentDetails;
}

export type CheckoutValidationErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'INVALID_ORDER_STATUS'
  | 'INVALID_DELIVERY'
  | 'INVALID_PAYMENT';

export interface CheckoutValidationResult {
  success: boolean;
  error?: string;
  errorCode?: CheckoutValidationErrorCode;
}
