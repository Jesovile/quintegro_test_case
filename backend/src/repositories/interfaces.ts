import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity, AddressRecord } from '../types/entities';

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

export interface IAddressRepository {
  findById(id: string): AddressRecord | undefined;
  findAll(): AddressRecord[];
}

/** Which user has already used which promo code (each code once per user). */
export interface IPromoRedemptionRepository {
  has(userId: string, promoId: string): boolean;
  add(userId: string, promoId: string): void;
}
