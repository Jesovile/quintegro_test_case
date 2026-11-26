export interface UserRecord {
  id: string;
  name: string;
}

export interface AuthRecord {
  userId: string;
  login: string;
  password: string;
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
}

export interface CheckoutRecord {
  orderId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
  paymentId: string;
  paymentProvider: string;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
