export interface ChargeRequest {
  amount: number;
  currency: string;
  card: {
    number: string;
    holderName: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
  };
}

export interface ChargeResult {
  ok: boolean;
  transactionId?: string;
  error?: string;
}

export interface PaymentProvider {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    await new Promise(resolve => setTimeout(resolve, 400));

    const digits = req.card.number.replace(/\s+/g, '');

    if (digits.startsWith('0000')) {
      return { ok: false, error: 'Card declined' };
    }

    if (digits.length < 12) {
      return { ok: false, error: 'Invalid card number' };
    }

    return {
      ok: true,
      transactionId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    };
  }
}
