import { MockPaymentProvider } from '../../src/services/paymentProvider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();
  const baseCard = {
    holderName: 'Jane Doe',
    expiryMonth: 12,
    expiryYear: 2030,
    cvv: '123'
  };

  it('succeeds on a regular card number', async () => {
    const result = await provider.charge({
      amount: 100,
      currency: 'USD',
      card: { ...baseCard, number: '4242424242424242' }
    });
    expect(result.ok).toBe(true);
    expect(result.transactionId).toMatch(/^mock_/);
  });

  it('declines cards beginning with 0000', async () => {
    const result = await provider.charge({
      amount: 100,
      currency: 'USD',
      card: { ...baseCard, number: '0000123412341234' }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Card declined');
  });

  it('rejects too-short card numbers', async () => {
    const result = await provider.charge({
      amount: 100,
      currency: 'USD',
      card: { ...baseCard, number: '12345' }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Invalid card number');
  });

  it('strips whitespace before evaluating card length', async () => {
    const result = await provider.charge({
      amount: 100,
      currency: 'USD',
      card: { ...baseCard, number: '4242 4242 4242 4242' }
    });
    expect(result.ok).toBe(true);
  });
});
