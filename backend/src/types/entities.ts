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

export type OrderStatus = 'created' | 'submited' | 'processing' | 'finished';

export type DeliveryOption = 'fast' | 'super_fast' | 'extra_fast';

export interface Address {
  fullName: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  street: string;
  apartment?: string;
}

export interface PaymentSummary {
  last4: string;
  cardholder: string;
  expMonth: number;
  expYear: number;
  bankTxnId: string;
  status: 'processing' | 'authorized' | 'declined';
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
  deliveryAddress?: Address;
  invoiceAddress?: Address;
  deliveryOption?: DeliveryOption;
  deliveryCost?: number;
  payment?: PaymentSummary;
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
  deliveryAddress?: Address;
  invoiceAddress?: Address;
  deliveryOption?: DeliveryOption;
  deliveryCost?: number;
  payment?: PaymentSummary;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
