import { describe, expect, it } from 'vitest';
import { MockBankGateway } from './mock/mockBankGateway';

describe('MockBankGateway', () => {
  const charge = (bank: MockBankGateway, cardToken: string, idempotencyKey = 'k1') =>
    bank.charge({ cardToken, amountUsd: 100, idempotencyKey });

  it('approves, declines and rejects unknown tokens', async () => {
    const bank = new MockBankGateway(0);

    expect(await charge(bank, 'tok_approve_a', 'a')).toMatchObject({ status: 'approved', paymentId: expect.stringMatching(/^pay_/) });
    expect(await charge(bank, 'tok_decline_a', 'b')).toMatchObject({ status: 'declined' });
    expect(await charge(bank, 'garbage', 'c')).toMatchObject({ status: 'declined' });
  });

  it('is idempotent by key: the same key gives the same payment, a new key a new payment (AC-3.4)', async () => {
    const bank = new MockBankGateway(0);

    const first = await charge(bank, 'tok_approve_a', 'k1');
    const again = await charge(bank, 'tok_approve_a', 'k1');
    const other = await charge(bank, 'tok_approve_a', 'k2');

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('keeps the first result when a retry with the same key uses another card', async () => {
    const bank = new MockBankGateway(0);
    const first = await charge(bank, 'tok_approve_a', 'k1');

    expect(await charge(bank, 'tok_decline_a', 'k1')).toEqual(first);
  });

  it('timeout token: the answer never arrives but the charge is applied and found by key (AC-3.4)', async () => {
    const bank = new MockBankGateway(0);

    const outcome = await Promise.race([
      charge(bank, 'tok_timeout_a', 'k1').then(() => 'answered'),
      new Promise(resolve => setTimeout(() => resolve('lost'), 30))
    ]);

    expect(outcome).toBe('lost');
    expect(await bank.getPaymentByKey('k1')).toMatchObject({ status: 'approved', paymentId: expect.stringMatching(/^pay_/) });
  });

  it('getPaymentByKey reports approved, declined and unknown', async () => {
    const bank = new MockBankGateway(0);
    const approved = (await charge(bank, 'tok_approve_a', 'ok')) as { paymentId: string };
    await charge(bank, 'tok_decline_a', 'no');

    expect(await bank.getPaymentByKey('ok')).toMatchObject({ status: 'approved', paymentId: approved.paymentId, refunded: false });
    expect(await bank.getPaymentByKey('no')).toEqual({ status: 'declined' });
    expect(await bank.getPaymentByKey('missing')).toEqual({ status: 'unknown' });
  });

  it('refund succeeds for a real payment and is idempotent by key', async () => {
    const bank = new MockBankGateway(0);
    const { paymentId } = (await charge(bank, 'tok_approve_a')) as { paymentId: string };

    expect(await bank.refund({ paymentId, amountUsd: 100, idempotencyKey: 'r1' })).toEqual({ status: 'refunded' });
    expect(await bank.refund({ paymentId, amountUsd: 100, idempotencyKey: 'r1' })).toEqual({ status: 'refunded' });
  });

  it('a repeated refund with another key is not a second refund of the money (AC-5.5)', async () => {
    const bank = new MockBankGateway(0);
    const { paymentId } = (await charge(bank, 'tok_approve_a')) as { paymentId: string };

    await bank.refund({ paymentId, amountUsd: 100, idempotencyKey: 'r1' });

    expect(await bank.getPaymentByKey('k1')).toMatchObject({ status: 'approved', refunded: true });
  });

  it('a failed refund is not remembered: the same key succeeds later (AC-5.3)', async () => {
    const bank = new MockBankGateway(0);
    const key = 'refund_shared';
    expect(await bank.refund({ paymentId: 'pay_not_yet', amountUsd: 100, idempotencyKey: key })).toEqual({ status: 'failed' });
    expect(await bank.refund({ paymentId: 'pay_not_yet', amountUsd: 100, idempotencyKey: key })).toEqual({ status: 'failed' });

    const { paymentId } = (await charge(bank, 'tok_approve_a')) as { paymentId: string };

    expect(await bank.refund({ paymentId, amountUsd: 100, idempotencyKey: key })).toEqual({ status: 'refunded' });
  });

  it('refund fails for a payment the bank does not know', async () => {
    const bank = new MockBankGateway(0);

    expect(await bank.refund({ paymentId: 'pay_unknown', amountUsd: 100, idempotencyKey: 'r1' })).toEqual({ status: 'failed' });
  });
});
