import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity } from '../types/entities';
import { CheckoutAttempt, CheckoutQuote, CheckoutSnapshot, SubmitOrderPayload } from '../checkout/types';

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
  findAll(): OrderRecord[];
  update(order: OrderRecord): void;
}

export interface IProductRepository {
  findById(id: string): ProductRecord | undefined;
  findAll(): ProductRecord[];
}

export interface ICheckoutStore {
  saveQuote(quote: CheckoutQuote): void;
  findQuote(quoteId: string): CheckoutQuote | undefined;
  claimAttempt(attempt: CheckoutAttempt): CheckoutAttempt;
  findAttempt(orderId: string, attemptId: string): CheckoutAttempt | undefined;
  updateAttempt(attempt: CheckoutAttempt): void;
  abandonAttempt(orderId: string, attemptId: string): void;
  isCartEditable(orderId: string): boolean;
  complete(orderId: string, attemptId: string, snapshot: CheckoutSnapshot, result: SubmitOrderPayload): void;
}

export interface IPromoRepository {
  findById(id: string): PromoEntity | undefined;
  findAll(): PromoEntity[];
}
