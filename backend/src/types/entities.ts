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

export type OrderStatus = 'created' | 'checkout' | 'paid' | 'processing' | 'deliver' | 'cancelled';

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  currency: 'USD';
}

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
  // Only these personal data are stored; the address lives in the Geo service behind addressRef
  contact?: Contact;
  addressRef?: string;
  payment?: PaymentRecord;
  // Charges that could not be refunded automatically; kept for a retry
  refundsPending?: Array<{ paymentId: string; amountUsd: number }>;
  // attempt numbers the jobs of the order and forms the idempotency key of each start
  fulfillment?: { jobId: string; failed: boolean; attempt: number };
}

// Without paymentId it is an attempt in progress: the order is frozen until the attempt is settled with the bank
export interface PaymentRecord {
  idempotencyKey: string;
  amountUsd: number;
  paymentId?: string;
}

export interface Contact {
  fullName: string;
  email: string;
  phone: string;
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
  promoActive: boolean;
  totals: OrderTotals;
  deliverySaved: boolean;
  processingFailed: boolean;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
