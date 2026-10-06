import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity } from '../types/entities';

export interface IUserRepository {
  findById(id: string): UserRecord | undefined;
  findAll(): UserRecord[];
}

export interface IAuthRepository {
  findByLogin(login: string): AuthRecord | undefined;
  findByLoginAndPassword(login: string, password: string): AuthRecord | undefined;
  findAll(): AuthRecord[];
}

export interface IOrderRepository {
  findById(orderId: string): OrderRecord | undefined;
  findByUserId(userId: string): OrderRecord[];
  findByPaymentId(paymentId: string): OrderRecord | undefined;
  findAll(): OrderRecord[];
  save(order: OrderRecord): void;
  update(order: OrderRecord): void;
  reset(): void;
}

export interface IProductRepository {
  findById(id: string): ProductRecord | undefined;
  findAll(): ProductRecord[];
}

export interface IPromoRepository {
  findById(id: string): PromoEntity | undefined;
  findAll(): PromoEntity[];
}

export interface BankPaymentSession {
  paymentId: string;
  paymentUrl: string;
}

export interface CardData {
  number: string;
  expiry: string;
  cvv: string;
}

export interface BankPaymentResult {
  paymentId: string;
  success: boolean;
  errorCode?: string;
}

export interface IBankService {
  initiatePayment(orderId: string, amount: number): BankPaymentSession;
  processPayment(paymentId: string, cardData?: CardData): BankPaymentResult;
  reset(): void;
}