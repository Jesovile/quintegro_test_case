import { describe, it, expect } from 'vitest';
import { evaluateMockPayment, MAGIC_DECLINE_CARD_NUMBER } from '../mockPaymentProvider';

describe('evaluateMockPayment', () => {
  it('returns failed with a failureReason for the magic decline card number', () => {
    const result = evaluateMockPayment(MAGIC_DECLINE_CARD_NUMBER);
    expect(result).toEqual({ outcome: 'failed', failureReason: 'Card declined by issuer (mock)' });
  });

  it('normalizes spaces before comparing (magic number entered with spaces still fails)', () => {
    const result = evaluateMockPayment('4000 0000 0000 0002');
    expect(result).toEqual({ outcome: 'failed', failureReason: 'Card declined by issuer (mock)' });
  });

  it('returns succeeded for any other well-formed card number', () => {
    const result = evaluateMockPayment('4242424242424242');
    expect(result).toEqual({ outcome: 'succeeded' });
  });
});
