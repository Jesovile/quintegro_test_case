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
  | 'new'
  | 'waitingPayment'
  | 'paymentProcess'
  | 'inProgress'
  | 'delivery'
  | 'done'
  | 'failed'
  | 'canceledByUser'
  | 'canceledByCompany';

export interface CheckoutData {
  address: string;
  phone: string;
  deliveryAt: string;
  comment?: string;
}

export interface OrderProduct {
  id: string;
  amount: number;
  price: number;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  products: OrderProduct[];
  promo?: PromoEntity;
  checkoutData?: CheckoutData;
  paymentId?: string;
  paymentUrl?: string;
  paymentInitiatedAt?: number;
}

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  createdAt: number;
  products: Array<{
    product: ProductRecord;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  checkoutData?: CheckoutData;
  paymentId?: string;
  paymentUrl?: string;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
