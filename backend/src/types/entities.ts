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

export type OrderStatus =
  | 'created'
  | 'submitted'
  | 'paid'
  | 'in_delivery'
  | 'finished'
  | 'cancelled';

export interface Address {
  country: string;
  city: string;
  streetAndHouseNumber: string;
  postalCode: string;
  phone: string;
}

export interface PaymentMethod {
  id: string;
  label: string;
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
  recipientName?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  comment?: string;
  paymentMethodId?: string;
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
  recipientName?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  comment?: string;
  paymentMethodId?: string;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
