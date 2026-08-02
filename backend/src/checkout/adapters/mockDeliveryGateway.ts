import { DeliveryGateway } from '../ports';
import {
  DeliveryCancelInput,
  DeliveryQuote,
  DeliveryQuoteInput,
  DeliveryScheduleInput,
  ScheduledDelivery,
} from '../types';

export class MockDeliveryGateway implements DeliveryGateway {
  private schedules = new Map<string, ScheduledDelivery>();
  private cancellations = new Set<string>();

  async quote(input: DeliveryQuoteInput): Promise<DeliveryQuote> {
    const isExpress = input.method === 'express';
    return {
      id: `delivery_quote_${input.method}_${input.address.postalCode}`,
      feeMinor: isExpress ? 2499 : 999,
      currency: 'USD',
      expiresAt: Date.now() + 15 * 60 * 1000,
      estimatedDeliveryAt: Date.now() + (isExpress ? 2 : 5) * 24 * 60 * 60 * 1000,
    };
  }

  async schedule(input: DeliveryScheduleInput): Promise<ScheduledDelivery> {
    const existing = this.schedules.get(input.idempotencyKey);
    if (existing) return existing;
    if (input.quoteId.includes('schedule_fail')) throw new Error('Mock delivery scheduling failed');
    const result = {
      reference: `delivery_${input.idempotencyKey}`,
      estimatedDeliveryAt: Date.now() + (input.quoteId.includes('_express_') ? 2 : 5) * 24 * 60 * 60 * 1000,
    };
    this.schedules.set(input.idempotencyKey, result);
    return result;
  }

  async cancel(input: DeliveryCancelInput): Promise<void> {
    if (input.deliveryReference.includes('cancel_fail')) throw new Error('Mock delivery cancellation failed');
    this.cancellations.add(input.idempotencyKey);
  }
}
