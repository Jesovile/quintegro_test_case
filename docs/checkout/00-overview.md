# Checkout Feature — Requirements Overview

**Status**: DRAFT — awaiting approval
**Phase**: 1 (Requirements) per `ai-workflow` SDLC
**Next phase**: Tech Design (`docs/tech-design.md`)

This overview ties together the per-feature requirement docs in this folder. Each feature has its own file with user stories and acceptance criteria; read this file first for the shared problem statement, scope boundaries, and definition of done.

---

## 1. Problem Statement

Today the app has no way to actually complete a purchase. A logged-in user can view a pre-seeded cart (an order with `status: created`), adjust quantities, and remove items, but the only "completion" action is a single button that flips the order's status without collecting a delivery address, a delivery method, or any payment. There is no review step, no payment step, and no way to see or cancel a placed order beyond the raw order list. As a result, the product cannot demonstrate a real purchase flow end-to-end — which is the core scenario this test case needs to prove out. Success looks like: a registered user can take a cart from "items I want" to "paid, confirmed order with a delivery address," see it appear in their order history, and cancel it afterward if needed — all backed by a mocked payment provider with realistic success/failure states on the frontend.

---

## 2. User Roles

- **Guest** — unauthenticated visitor. Can browse but is redirected to login when attempting checkout. No guest checkout in this scope.
- **User** — authenticated, owns their own cart/orders. The only role that can run checkout.
- **System (mock payment provider)** — simulated backend component that accepts a payment request and returns success or failure; no real money movement.

---

## 3. Feature Breakdown

| # | Feature doc | Summary |
|---|---|---|
| 1 | [`01-auth-gated-checkout.md`](01-auth-gated-checkout.md) | Checkout is only reachable by authenticated users |
| 2 | [`02-delivery-selection.md`](02-delivery-selection.md) | Manual delivery address entry + choice of Regular / Extra delivery method |
| 3 | [`03-order-review.md`](03-order-review.md) | Review screen showing cart, address, delivery, total before payment |
| 4 | [`04-online-payment.md`](04-online-payment.md) | Card payment step — mocked on backend, fully-stated on frontend (pending/processing/success/failure) |
| 5 | [`05-order-confirmation-and-history.md`](05-order-confirmation-and-history.md) | Post-payment confirmation, cart clearing, order appears in order history |
| 6 | [`06-order-cancellation.md`](06-order-cancellation.md) | User can cancel an already-paid order from the order history page |

Read order matters for design: 1 gates entry → 2 and 3 form the checkout wizard → 4 is the payment step → 5 is the outcome → 6 is a follow-on capability on the existing order-history page.

---

## 4. Non-Functional Requirements (cross-feature)

**Security:**
- Checkout mutations require a valid JWT; a user can only checkout/cancel their own orders (row-level isolation, matching existing `order.userId !== userId` pattern).
- All data the user enters during checkout — including the full card number, expiry, CVV, and cardholder name — is persisted on the backend, by explicit product decision (see feature 4). This deviates from real-world PCI practice (CVV is normally never stored) but is accepted here because the payment provider is fully mocked with no real gateway or real money involved.

**Reliability:**
- Submitting payment must be idempotent — retrying after a network blip must not create a duplicate order or double-charge.
- If the mock payment fails, the cart (order in `created` status) must remain intact so the user can retry without re-entering items.

**Performance:**
- Existing backend has an artificial 1500ms delay middleware and a 1-in-5 chance of a 500 error on every request (`errorTestMiddleware`) — the checkout UI must handle these gracefully (loading states, retry affordance) since they will fire during normal use, not just in error-path testing.

**Usability:**
- Every payment state (submitting, processing, success, failure) must be visibly represented in the UI — this is explicitly required even though the payment itself is mocked, since demonstrating the full state machine is part of the deliverable.

---

## 5. Out of Scope (applies across all features below)

- Guest checkout (no account) — registered users only, per feature 1
- Adding products to the cart from a product catalog ("add to cart") — checkout only operates on the existing pre-seeded cart/order
- Stock/inventory availability checks — no stock model exists and none is being introduced
- Promo code entry/application in the checkout UI — promo calculation exists server-side but is not part of this scope
- Self-pickup / in-store pickup as a delivery option — only courier/post delivery, with two method tiers (Regular, Extra)
- Saved/reusable delivery addresses or an address book — address is entered manually every checkout
- Real payment gateway integration (Stripe, YooKassa, etc.) — backend payment is mocked
- Order editing after payment (changing items, address, or delivery method on a paid order) — only cancellation is supported post-payment
- Refunds / partial cancellation of individual line items — cancellation is whole-order only
- Email or push notifications on order status changes

---

## 6. Data Entities Touched (identification only — no schema design here)

```
**Order** (existing, `OrderRecord`) — needs new fields: deliveryAddress, deliveryMethod, paymentStatus/paymentInfo, and a new `cancelled` value in the status enum
**DeliveryAddress** (new) — recipient name, phone, address lines, entered per-checkout, not persisted for reuse
**DeliveryMethod** (new) — enum-like: Regular | Extra, each with a fixed price and an estimated delivery window
**Payment** (new) — mock payment attempt record: method (card), masked card info, status (pending/processing/succeeded/failed), timestamp
```

---

## 7. Definition of Done (for the whole checkout epic)

- [ ] All MUST stories across features 1–6 implemented
- [ ] All MUST acceptance criteria pass in the running app (manually verified given no DB/CI in this project)
- [ ] A guest cannot reach any checkout step
- [ ] A user can go: cart → address + delivery type → review → mock payment → confirmation → order visible in history → cancel
- [ ] Payment failure path returns the user to checkout with the cart intact and a clear error
- [ ] No card data logged or persisted in plaintext beyond what a mock reasonably needs
- [ ] `docs/decisions.md` records any non-obvious decisions made during design (e.g., how the mock provider decides success/failure)

---

## 8. Cross-Feature Open Questions

| # | Question | Impact if unresolved | Assumption made |
|---|---|---|---|
| Q1 | How does the mock payment provider decide success vs. failure? | Affects payment UX testability | Assumed: a deterministic rule the architect defines in design (e.g., specific test card number triggers failure), so the flow is demoable on demand, not left to random chance |
| Q2 | Can a user have more than one `created`-status cart at a time? | Affects which "cart" checkout operates on | Assumed NO — current seed data implies a single active cart per user; checkout targets the user's one `created` order |
| Q3 | Is there a time window after which a paid order can no longer be cancelled (e.g., once shipped)? | Affects cancellation eligibility rules in feature 6 | Assumed NO time limit for v1 — cancellable any time before the (out-of-scope) fulfillment/shipping step, since no shipping-status modeling exists yet |
