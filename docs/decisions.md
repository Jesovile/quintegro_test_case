# Architecture Decision Log

Non-obvious decisions made during design/implementation of the checkout epic, per the epic's Definition of Done (`docs/checkout/00-overview.md` §7).

---

## Feature 4 — Online Card Payment (Mocked)

### 2026-07-10 — Deterministic mock-payment rule, magic decline card number

**Decision**: The mock payment provider (`backend/src/services/mockPaymentProvider.ts`) decides success/failure deterministically by card number, not randomly. A single hardcoded "magic" card number, `4000000000000002`, always results in a declined payment; any other well-formed card number always succeeds.

**Rationale**: Overview Q1 / feature-4 Q4.1 flagged that a random success/failure rule would make the failure path undemoable on request. Borrowing the "magic test card" convention from real providers (e.g. Stripe's declined-card test numbers) lets QA/demo reliably trigger either path by choice of card number, independent of the unrelated chaos (`errorTestMiddleware`, 1-in-5 500) and delay (`delayMiddleware`, 1500ms) middlewares that also affect the request.

### 2026-07-10 — Full, unmasked card data persistence (PCI deviation)

**Decision**: `PaymentRecord` (`backend/src/types/entities.ts`) persists the full, unmasked `cardNumber`, `expiry`, `cvv`, and `cardholderName` exactly as entered. This is an explicit, approved deviation from real-world PCI practice, where CVV in particular is never stored. It is accepted here specifically because the payment provider is fully mocked — there is no real gateway and no real money movement.

Only the read-model projection returned over GraphQL, `PaymentSummaryDTO` (via `PaymentService.toSummary`), masks the card down to `cardLast4` and omits `cvv`/`expiry`/the full card number entirely. Storage is never masked; only the outward-facing display layer is.

**Rationale**: `docs/checkout/04-online-payment.md`'s Non-Functional Requirements section states this explicitly as a product requirement, not an oversight — do not "fix" it by masking/dropping fields at write time in a future change.

### 2026-07-10 — Ownership check runs unconditionally, before the idempotency-key lookup

**Decision**: `PaymentService.pay` validates `order.userId === userId` as the very first step, unconditionally, before branching on whether the supplied `idempotencyKey` matches an existing `PaymentRecord`.

**Rationale**: An earlier draft only checked ownership in the "fresh attempt" branch. Because `findByIdempotencyKey` keys only on `(orderId, idempotencyKey)` — not `userId` — a client that guessed or observed another user's `idempotencyKey` for a given `orderId` could hit the replay branch and read back that order/payment without ever being ownership-checked. Moving the check to the very first step closes this for both branches uniformly. This was caught as a real vulnerability during design review.

### 2026-07-10 — `pay` resolver rethrows the original error (no generic-message swallowing)

**Decision**: The three new checkout resolvers (`submitDeliveryDetails`, `pay`, `cancelOrder`) do not wrap their service calls in a try/catch that flattens the real error into a generic hardcoded string, unlike the legacy resolvers (`orders`, `order`, `submitOrder`, `deleteProductFromOrder`) in the same file. `pay` in particular has no try/catch at all — a thrown `Error`'s message (`'Order not found or access denied'`, `'Order cannot be paid in its current status'`, a card-validation error, etc.) propagates to the client unchanged.

**Rationale**: The legacy pattern would flatten every distinct failure reason into one indistinguishable message, breaking the frontend's ability to render different UI/copy for an ownership violation vs. a status violation vs. a validation error. This is a deliberate, scoped deviation for the three new checkout mutations only — the legacy resolvers are left untouched.

---

## Feature 5 — Order Confirmation & Order History Update

### 2026-07-10 — Backend guard on `deleteProductFromOrder`/`updateProductAmount` is a status check, not a UI-only fix

**Decision**: `OrderService.deleteProductFromOrder` and `OrderService.updateProductAmount` throw `'Order cannot be modified in its current status'` whenever `order.status !== 'created'`, checked immediately after the existing ownership check and before any mutation. This applies regardless of caller — GraphQL Playground and the legacy REST layer both funnel through these same two methods.

**Rationale**: Design review found that hiding the quantity +/− and delete controls in the UI (the `OrderListItem`/`OrderHistoryItem` split) only stops the *normal* UI path. Any authenticated user could still call these two mutations directly against their own `paid`/`cancelled` order via GraphQL Playground and edit its line items post-payment, directly contradicting the "no order editing after payment" requirement. The backend guard is the actual fix; the UI split is necessary but not sufficient on its own and would otherwise be security theater.

### 2026-07-10 — `OrderService`/`PaymentService` cross-dependency wired via setter injection, not a constructor cycle

**Decision**: `OrderService.transformToDTO` needs `PaymentService.getSummaryForOrder` to populate `OrderDTO.payment` for order-history/confirmation display (a gap Feature 4 explicitly flagged and left for Feature 5 to close). Since `PaymentService` already takes `OrderService` as a constructor dependency (Feature 4), giving `OrderService` a `PaymentService` constructor dependency in return would be circular. Instead, `OrderService` exposes `setPaymentService(paymentService)`, called once from `app.ts` right after both services are constructed; `OrderService` only imports `PaymentService`'s type (`import type`), which is erased at compile time, so there is no circular runtime `require()`.

**Rationale**: Avoids restructuring either service's existing constructor shape (frozen by earlier features' plans/tests) while still giving `OrderService` what it needs. `payment` stays `undefined` (as before this change) for any `OrderService` instance that never has `setPaymentService` called on it — a safe, non-breaking default for existing tests that construct `OrderService` standalone.

### 2026-07-10 — "Cart" label vs. payment-status badge distinguishes an active cart from order history (AC-503-2)

**Decision**: `OrderList.tsx` labels a `status === 'created'` order as "Cart" in its heading (`Order #{id} - Cart`) rather than showing a payment-status badge; `paid`/`cancelled`/`submited`/`finished` orders render via `OrderHistoryItem`, which shows a colored status badge ("Paid"/"Cancelled"/"Submitted"/"Finished") instead.

**Rationale**: AC-503-2 requires an active cart and paid orders to be visually distinguishable when both are present (an edge case, since add-to-cart is out of scope and no code path currently produces two `created` orders — but the UI must not crash or look ambiguous if it ever happens, e.g. via direct seed-data manipulation). Reusing the existing `OrderListItem`/`OrderHistoryItem` component split (introduced in this same feature for the backend-guard-adjacent security fix) to also carry this labeling distinction avoids introducing a third rendering path.

---

## Feature 6 — Order Cancellation

### 2026-07-10 — Cancelling an order does not touch `PaymentRecord.status`; no refund modeling

**Decision**: `OrderService.cancelOrder` changes only `Order.status` to `'cancelled'` (and sets `Order.cancelledAt`). The underlying `PaymentRecord.status` for that order's payment stays `'succeeded'` — it is never rewritten to `'failed'`, `'refunded'`, or any other value.

**Rationale**: The payment did, in fact, succeed — that is a historical record. Cancellation is a separate, order-level event layered on top of it. No real payment gateway exists in this scope to actually refund from (out of scope per `docs/checkout/00-overview.md` §5), so there is nothing to reconcile `PaymentRecord.status` against. A future refund feature would model this as a new event/status rather than mutating the original payment attempt's outcome.

### 2026-07-10 — `OrderList.tsx` owns `useMutation(CANCEL_ORDER)`, not `OrderHistoryItem.tsx`

**Decision**: The "Cancel Order" mutation call lives in `OrderList.tsx` (matching its existing `handleDelete`/`handleAmountChange` local-state-update convention for `OrderListItem`). `OrderHistoryItem.tsx` receives `onCancel`/`cancelling`/`cancelError` as props (declared, unused, by Feature 5) and only renders the button and calls the passed-in `onCancel` — it never calls `useMutation` itself.

**Rationale**: Plan review flagged an architecture ambiguity between "component owns its own mutation" and "parent owns the mutation, child is presentational" for this feature. Parent-owns-it was chosen because `OrderList`'s `orders` array (fetched via `GET_ORDERS`) is the single source of truth the order-history list renders from; updating it in one place on `onCompleted`/`onError` avoids a second, redundant piece of state living inside `OrderHistoryItem` that would need to be kept in sync with the parent's list.

### 2026-07-10 — No confirmation dialog before cancelling

**Decision**: Clicking "Cancel Order" calls `onCancel(orderId)` immediately — no `window.confirm`, no modal, no intermediate step.

**Rationale**: `docs/checkout/06-order-cancellation.md` explicitly lists this as out of scope for v1 ("one click is sufficient"). Verified by a component test that spies on `window.confirm` and asserts no dialog/modal role is rendered.
