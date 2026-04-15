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

export type DeliveryOption = 'fast' | 'fastest';

export interface DeliveryInfo {
  name: string;
  addressLine1: string;
  addressLine2: string;
  zip: string;
  city: string;
  country: string;
  phoneCode: string;
  phoneNumber: string;
  option: DeliveryOption;
}

export interface PaymentInfo {
  cardLastFour: string;
  cardHolderName: string;
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
  delivery?: DeliveryInfo;
  payment?: PaymentInfo;
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
  delivery?: DeliveryInfo;
  payment?: PaymentInfo;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
