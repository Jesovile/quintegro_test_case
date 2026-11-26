import { CheckoutRecord } from '../types/entities';
import { ICheckoutRepository } from './interfaces';

export class InMemoryCheckoutRepository implements ICheckoutRepository {
  private checkouts = new Map<string, CheckoutRecord>();

  findByOrderId(orderId: string): CheckoutRecord | undefined {
    const checkout = this.checkouts.get(orderId);
    return checkout ? this.copy(checkout) : undefined;
  }

  save(checkout: CheckoutRecord): void {
    this.checkouts.set(checkout.orderId, this.copy(checkout));
  }

  reset(): void {
    this.checkouts.clear();
  }

  private copy(checkout: CheckoutRecord): CheckoutRecord {
    // Explicit fields keep request-only data out even if callers pass extra properties.
    return {
      orderId: checkout.orderId,
      userId: checkout.userId,
      firstName: checkout.firstName,
      lastName: checkout.lastName,
      email: checkout.email,
      phone: checkout.phone,
      address: checkout.address,
      zipcode: checkout.zipcode,
      paymentId: checkout.paymentId,
      paymentProvider: checkout.paymentProvider
    };
  }
}
