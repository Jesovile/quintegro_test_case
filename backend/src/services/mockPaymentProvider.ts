// Pure, deterministic mock payment decision function — no I/O, no
// repository/service dependency, so the rule is independently unit-testable.
// See tech-design.md §5. Answers overview Q1 / feature-4 Q4.1: deterministic
// by card number, not random.

export interface MockPaymentOutcome {
  outcome: 'succeeded' | 'failed';
  failureReason?: string;
}

// Convention borrowed from real providers' test-card numbering (e.g. Stripe's
// declined-card test number) — see docs/decisions.md.
export const MAGIC_DECLINE_CARD_NUMBER = '4000000000000002';

export function evaluateMockPayment(cardNumber: string): MockPaymentOutcome {
  const normalized = cardNumber.replace(/\s+/g, '');
  if (normalized === MAGIC_DECLINE_CARD_NUMBER) {
    return { outcome: 'failed', failureReason: 'Card declined by issuer (mock)' };
  }
  return { outcome: 'succeeded' };
}
