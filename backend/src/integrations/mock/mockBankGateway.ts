import { randomUUID } from 'crypto';
import { ChargeResult, IBankGateway, PaymentLookup } from '../interfaces';

// Tokens issued by the browser-side mock tokenizer; the prefix selects the scenario
export const MOCK_TOKEN_PREFIX = {
  approve: 'tok_approve_',
  decline: 'tok_decline_',
  // The bank applies the charge but the answer never arrives
  timeout: 'tok_timeout_'
} as const;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockBankGateway implements IBankGateway {
  private charges = new Map<string, { result: ChargeResult; amountUsd: number }>();
  private refunds = new Map<string, { status: 'refunded' | 'failed' }>();
  private refundedPayments = new Set<string>();

  constructor(private delayMs = 300) {}

  async charge({ cardToken, amountUsd, idempotencyKey }: { cardToken: string; amountUsd: number; idempotencyKey: string }): Promise<ChargeResult> {
    await wait(this.delayMs);

    const previous = this.charges.get(idempotencyKey);
    if (previous) {
      return previous.result;
    }

    const result: ChargeResult = cardToken.startsWith(MOCK_TOKEN_PREFIX.decline)
      ? { status: 'declined', reason: 'Card declined' }
      : cardToken.startsWith(MOCK_TOKEN_PREFIX.approve) || cardToken.startsWith(MOCK_TOKEN_PREFIX.timeout)
        ? { status: 'approved', paymentId: `pay_${randomUUID()}` }
        : { status: 'declined', reason: 'Unknown card token' };
    this.charges.set(idempotencyKey, { result, amountUsd });

    if (cardToken.startsWith(MOCK_TOKEN_PREFIX.timeout)) {
      // Only the first attempt is lost; a retry with the same key gets the stored result
      return new Promise<ChargeResult>(() => undefined);
    }
    return result;
  }

  async getPaymentByKey(idempotencyKey: string): Promise<PaymentLookup> {
    await wait(this.delayMs);

    const charge = this.charges.get(idempotencyKey);
    if (!charge) {
      return { status: 'unknown' };
    }
    const { result, amountUsd } = charge;
    return result.status === 'approved'
      ? { status: 'approved', paymentId: result.paymentId, amountUsd, refunded: this.refundedPayments.has(result.paymentId) }
      : { status: 'declined' };
  }

  async refund({ paymentId, amountUsd, idempotencyKey }: { paymentId: string; amountUsd: number; idempotencyKey: string }): Promise<{ status: 'refunded' | 'failed' }> {
    await wait(this.delayMs);

    const previous = this.refunds.get(idempotencyKey);
    if (previous) {
      return previous;
    }
    // Only the charged amount of a real payment can be refunded
    const charged = [...this.charges.values()].some(
      ({ result, amountUsd: charge }) => result.status === 'approved' && result.paymentId === paymentId && charge === amountUsd
    );
    if (!charged) {
      // Not remembered: a failed refund may be retried with the same key
      return { status: 'failed' };
    }
    const result = { status: 'refunded' as const };
    this.refundedPayments.add(paymentId);
    this.refunds.set(idempotencyKey, result);
    return result;
  }
}
