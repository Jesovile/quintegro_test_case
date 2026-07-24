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

// AddressInput mirrors Address's shape but is the wire type accepted from the
// checkout form (kept as a distinct alias in case shipping/billing input
// validation ever needs to diverge from the persisted Address shape).
export type AddressInput = Address;

export interface CheckoutInput {
  recipientName: string;
  shipping: AddressInput;
  // billing omitted/null signals "same as shipping" — the service copies the
  // shipping address into billingAddress in that case (see orderService.ts).
  billing?: AddressInput | null;
  comment?: string | null;
  paymentMethodId: string;
}

export type SubmitOrderResult =
  | { success: true; order: OrderDTO }
  | { success: false; error: string };

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
