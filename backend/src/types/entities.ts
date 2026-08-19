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
  price: number;
  stock: number;
}

export type OrderStatus = 'created' | 'reserved' | 'paid' | 'submited' | 'finished';

export interface AddressRecord {
  fullName: string;
  country: string;
  city: string;
  street: string;
  postalCode: string;
  phone: string;
}

export interface DeliveryOptionRecord {
  id: string;
  provider: string;
  title: string;
  price: number;
  etaDays: number;
  description: string;
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
  address?: AddressRecord;
  deliveryOption?: DeliveryOptionRecord;
  reservedUntil?: number;
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
  address?: AddressRecord;
  deliveryOption?: DeliveryOptionRecord;
  reservedUntil?: number;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
