import { UserRecord, AuthRecord, OrderRecord, OrderStatus, ProductRecord, PromoEntity } from '../types/entities';

// Fields a status transition may change; owner, id and composition are never part of it
export type OrderTransitionPatch = Pick<OrderRecord, 'status'>;

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
  // Applies the patch only while the order is in one of the expected statuses, in one synchronous step
  transition(orderId: string, from: OrderStatus[], patch: OrderTransitionPatch): OrderRecord | null;
}

export interface IProductRepository {
  findById(id: string): ProductRecord | undefined;
  findAll(): ProductRecord[];
}

export interface IPromoRepository {
  findById(id: string): PromoEntity | undefined;
  findAll(): PromoEntity[];
}
