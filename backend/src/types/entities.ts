import type { CheckoutSnapshot } from '../checkout/types';

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

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: 'created' | 'submited' | 'finished';
  createAt: number;
  products: Array<{
    id: string;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  checkout?: CheckoutSnapshot;
}

export interface OrderDTO {
  orderId: string;
  status: 'created' | 'submited' | 'finished';
  products: Array<{
    product: ProductRecord;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  checkout?: CheckoutSnapshot;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
