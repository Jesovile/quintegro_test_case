import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity, DeliveryMethodOption, DeliveryMethodType, PaymentRecord } from '../types/entities';

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

export interface IPromoRepository {
  findById(id: string): PromoEntity | undefined;
  findAll(): PromoEntity[];
}

export interface IDeliveryMethodRepository {
  findAll(): DeliveryMethodOption[];
  findByType(type: DeliveryMethodType): DeliveryMethodOption | undefined;
}

// See tech-design.md §2.4. One PaymentRecord per payment attempt — failed
// attempts remain in the repository as an audit trail.
export interface IPaymentRepository {
  findById(paymentId: string): PaymentRecord | undefined;
  findByOrderId(orderId: string): PaymentRecord[];
  findByIdempotencyKey(orderId: string, idempotencyKey: string): PaymentRecord | undefined;
  create(payment: PaymentRecord): void;
  update(payment: PaymentRecord): void;
}
