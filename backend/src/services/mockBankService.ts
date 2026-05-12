export interface BankChargeRequest {
  cardNumber: string;
  cvv: string;
  cardholder: string;
  expMonth: number;
  expYear: number;
  amount: number;
  currency?: string;
  reference?: string;
}

export interface BankChargeResult {
  bankTxnId: string;
  status: 'processing';
  last4: string;
}

export class MockBankService {
  async chargeCard(req: BankChargeRequest): Promise<BankChargeResult> {
    await new Promise(resolve => setTimeout(resolve, 400));

    const digits = req.cardNumber.replace(/\s+/g, '');
    const last4 = digits.slice(-4);

    return {
      bankTxnId: `mock-txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'processing',
      last4,
    };
  }
}
