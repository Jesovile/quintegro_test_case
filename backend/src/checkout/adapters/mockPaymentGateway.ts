import { PaymentGateway } from '../ports';
import {
  PaymentAuthorization,
  PaymentAuthorizationInput,
  PaymentCapture,
  PaymentCaptureInput,
  PaymentVoidInput,
} from '../types';

export class MockPaymentGateway implements PaymentGateway {
  private authorizations = new Map<string, PaymentAuthorization>();
  private captures = new Map<string, PaymentCapture>();
  private voids = new Set<string>();

  async authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization> {
    const existing = this.authorizations.get(input.idempotencyKey);
    if (existing) return existing;

    let result: PaymentAuthorization;
    if (input.paymentMethodToken.includes('decline')) {
      result = { status: 'declined', errorCode: 'PAYMENT_DECLINED' };
    } else if (input.paymentMethodToken.includes('action')) {
      result = { status: 'requires_action', errorCode: 'ACTION_REQUIRED' };
    } else if (input.paymentMethodToken.includes('unavailable')) {
      result = { status: 'unavailable', errorCode: 'PAYMENT_UNAVAILABLE' };
    } else {
      const failureSuffix = input.paymentMethodToken.includes('capture_fail') ? '_capture_fail'
        : input.paymentMethodToken.includes('void_fail') ? '_void_fail' : '';
      result = { status: 'authorized', reference: `pay_auth_${input.idempotencyKey}${failureSuffix}` };
    }
    this.authorizations.set(input.idempotencyKey, result);
    return result;
  }

  async capture(input: PaymentCaptureInput): Promise<PaymentCapture> {
    const existing = this.captures.get(input.idempotencyKey);
    if (existing) return existing;
    const result = input.authorizationReference.includes('capture_fail')
      ? { status: 'unavailable', errorCode: 'CAPTURE_UNAVAILABLE' } as const
      : { status: 'captured', reference: `pay_cap_${input.idempotencyKey}` } as const;
    this.captures.set(input.idempotencyKey, result);
    return result;
  }

  async void(input: PaymentVoidInput): Promise<void> {
    if (input.authorizationReference.includes('void_fail')) throw new Error('Mock void failed');
    this.voids.add(input.idempotencyKey);
  }
}
