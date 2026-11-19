import type { PaymentGateway, PaymentRequest, PaymentResult } from './paymentGateway'

/**
 * Development-only payment gateway. It deliberately does not persist or log
 * card details and always returns a successful authorization.
 */
export class MockPaymentGateway implements PaymentGateway {
  async pay(_request: PaymentRequest): Promise<PaymentResult> {
    return {
      providerPaymentId: `mock_${crypto.randomUUID()}`,
      status: 'succeeded',
      paidAt: new Date().toISOString(),
    }
  }
}

export const paymentGateway = new MockPaymentGateway()
