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

export type OrderStatus = 'created' | 'checkout' | 'submited' | 'finished';

export interface ShippingInfo {
  fullName: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

export interface PaymentInfo {
  brand: string;
  last4: string;
  holderName: string;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createAt: number;
  placedAt?: number;
  products: Array<{
    id: string;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  shipping?: ShippingInfo;
  payment?: PaymentInfo;
}

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  createAt: number;
  placedAt?: number;
  products: Array<{
    product: ProductRecord;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  shipping?: ShippingInfo;
  payment?: PaymentInfo;
}

export interface CheckoutDraftInput {
  shipping?: ShippingInfo;
  payment?: PaymentInfo;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
