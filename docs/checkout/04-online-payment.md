# Feature 4: Online Card Payment (Mocked)

**Parent**: [00-overview.md](00-overview.md)

## Problem

The order needs to actually be paid for online by card. There's no real payment gateway in scope — the backend will simulate the payment outcome — but the frontend must fully implement the user-facing payment experience: card entry, submission, and every state a real integration would have (pending/submitting, processing, success, failure), so the flow is genuinely demoable end to end, not just stubbed.

## User Roles Involved

- **User** — enters card details and pays
- **System (mock payment provider)** — simulates authorization and returns success or failure

## User Stories

### US-401: Enter card details

**As a** user on the payment step
**I want to** enter my card number, expiry, CVV, and cardholder name
**So that** I can pay for my order

**Acceptance Criteria:**
- [ ] AC-401-1: Given I am on the payment step, when the form loads, then I see fields for card number, expiry (MM/YY), CVV, and cardholder name, all empty
- [ ] AC-401-2: Given I enter a card number that fails basic format validation (wrong length / non-numeric), when I try to submit, then I see a field-level validation error and cannot submit
- [ ] AC-401-3: Given I enter an expiry date in the past, when I try to submit, then I see a validation error and cannot submit
- [ ] AC-401-4: Given all fields pass client-side validation, when I click "Pay", then the payment submission begins (US-402)

**Priority**: MUST
**Effort hint**: M

### US-402: See live payment status while it's processing

**As a** user who just clicked "Pay"
**I want to** see a clear in-progress state
**So that** I know my payment is being handled and don't double-submit

**Acceptance Criteria:**
- [ ] AC-402-1: Given I clicked "Pay", when the request is in flight, then the Pay button becomes disabled and shows a "Processing…" indicator (spinner or equivalent)
- [ ] AC-402-2: Given payment is processing, when I try to click "Pay" again or navigate away, then a duplicate submission is prevented (button disabled / navigation guarded)
- [ ] AC-402-3: Given the backend's artificial request delay (existing 1500ms middleware) is in effect, when I'm waiting, then the processing state remains visible the whole time rather than flickering or appearing frozen

**Priority**: MUST
**Effort hint**: S

### US-403: See success outcome

**As a** user whose mock payment succeeds
**I want to** get a clear success confirmation
**So that** I know the order is placed and paid

**Acceptance Criteria:**
- [ ] AC-403-1: Given the mock payment provider returns success, when the response arrives, then the order status changes to paid/submitted and I am taken to the confirmation view (feature 5)
- [ ] AC-403-2: Given payment succeeded, when I look at my order afterward, then it shows a "Paid" (or equivalent) payment status, not still "created"

**Priority**: MUST
**Effort hint**: S

### US-404: See failure outcome and recover

**As a** user whose mock payment fails
**I want to** see a clear error and be able to try again
**So that** I'm not stuck or double-charged

**Acceptance Criteria:**
- [ ] AC-404-1: Given the mock payment provider returns failure, when the response arrives, then I see a clear error message explaining payment failed (not a generic crash/blank screen)
- [ ] AC-404-2: Given payment failed, when I return to the payment/checkout step, then my cart (order in `created` status) is unchanged — no items lost, no order marked as paid
- [ ] AC-404-3: Given payment failed, when I look at the form, then my previously entered address/delivery selections from earlier steps are still intact (I don't have to redo the whole checkout, only re-attempt payment)
- [ ] AC-404-4: Given payment failed, when I click "Pay" again, then a new payment attempt is made (no lockout after one failure) — the exact retry limit/backoff, if any, is a design-phase decision
- [ ] AC-404-5: Given the artificial 500-error chaos middleware fires during a payment request (existing 1-in-5 global request failure), when that happens, then it is surfaced to the user as a payment/network error using the same failure UI as AC-404-1, not an unhandled exception

**Priority**: MUST
**Effort hint**: M

## Non-Functional Requirements

- **All data the user enters must be persisted, in full — this is an explicit product requirement.** The card number, expiry, CVV, and cardholder name entered in US-401 must all be saved on the backend against the payment/order record, not discarded or reduced to a masked form. This is an intentional deviation from real-world PCI practice (where CVV in particular is never stored) — accepted here specifically *because* the payment provider is fully mocked with no real money movement or real gateway involved. Flagged as a recorded product decision, not an oversight; do not "fix" it by masking/dropping fields during implementation.
- Payment submission must be idempotent server-side (a retried request due to a network blip must not create two paid orders) — flagged as a backend design requirement
- All four states (idle/entering, processing, success, failure) must have distinct, visibly different UI — this is an explicit product requirement, not an implementation detail, because demonstrating the full state machine is part of what's being delivered

## Out of Scope

- Real payment gateway integration (Stripe, YooKassa, PayPal, etc.)
- Storing card details for future reuse ("save this card")
- Multiple payment methods (only card, no wallet/bank transfer/COD — COD was explicitly rejected)
- 3-D Secure / OTP / any multi-step card authentication flow
- Partial payments / installments

## Data Entities Involved

```
**Payment** (new) — orderId, method: 'card', cardNumber (full, as entered), expiry, cvv, cardholderName, status: 'pending' | 'processing' | 'succeeded' | 'failed', createdAt, failureReason (if failed)
```

## Open Questions

| # | Question | Impact | Assumption |
|---|---|---|---|
| Q4.1 | How exactly does the mock decide success vs. failure — random chance, a specific "always fails" test card number, or a config flag? | Directly affects whether QA/demo can reliably trigger the failure path | Assumed: architect defines a deterministic rule (e.g. a magic card number like `4000000000000002` always fails, matching common real-provider test-card conventions) so both paths are reliably demoable |
| Q4.2 | Is there a max retry count or cooldown after repeated failures? | Affects US-404 scope | Assumed NO limit for v1 — unlimited retries, revisit if abuse becomes a concern |
