import { PaymentInfo } from '../types/entities';

export interface ICheckoutRepository {
  save(info: PaymentInfo): void;
  findByOrderId(orderId: string): PaymentInfo | undefined;
  reset(): void;
}

export class InMemoryCheckoutRepository implements ICheckoutRepository {
  private payments: Map<string, PaymentInfo> = new Map();

  save(info: PaymentInfo): void {
    this.payments.set(info.orderId, info);
  }

  findByOrderId(orderId: string): PaymentInfo | undefined {
    return this.payments.get(orderId);
  }

  reset(): void {
    this.payments.clear();
  }
}
