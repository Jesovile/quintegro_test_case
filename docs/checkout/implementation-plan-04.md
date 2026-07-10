# Implementation Plan — Feature 4: Online Card Payment (Mocked)

**Parent tech design**: [`tech-design.md`](tech-design.md) (frozen contract — §2, §3, §5, §6 in particular)
**Parent requirements**: [`04-online-payment.md`](04-online-payment.md), [`00-overview.md`](00-overview.md)
**Scope of this plan**: US-401–US-404 only. Features 1–3, 5, 6 are planned separately against the same tech-design.md; see "Shared/Cross-Feature Files" and "Dependency Position" below for how this plan interlocks with them.

---

## Dependency Position in the Epic

Feature 4 sits in the middle of the checkout wizard:

- **Depends on** (must exist, or be stubbed, before this feature's user-facing flow is fully testable):
  - Feature 1 — `PrivateRoute`, `/checkout/*` route nesting, `CheckoutProvider`/`CheckoutContext`, `currentCart` query
  - Feature 2 — `Order.deliveryAddress` / `Order.deliveryMethod` persisted on the order before payment (an order with no delivery method has no `fee` to add to the total)
  - Feature 3 — `OrderService.calculateOrderTotal` (subtotal with promo + delivery fee), used as the *single* source of truth for `PaymentRecord.amount` (§5 step 3, §4.3)
- **Precedes**:
  - Feature 5 (confirmation & history) — reads `PaymentSummaryDTO` via `Order.payment` and displays `CheckoutConfirmationPage` after a successful `pay`; this plan stubs a minimal confirmation placeholder route so `/checkout/confirmation/:orderId` doesn't 404 before feature 5 lands
  - Feature 6 (cancellation) — `cancelOrder` only operates on orders in `status === 'paid'`, a state this feature is what actually produces

Because features are planned/built concurrently, several iterations below declare an **external dependency** with a **fallback stub** so this feature's backend and frontend slices are independently mergeable and demoable even if features 1–3 land later or in a different order. Each fallback is explicitly marked for removal once the owning feature's real implementation merges.

---

## Shared / Cross-Feature Files

These files are touched by this plan AND by at least one other feature's plan. Coordinate merge order / expect rebases.

| File | Touched by this plan for | Also touched by | Conflict risk |
|---|---|---|---|
| `backend/src/types/entities.ts` | Add `PaymentStatus`, `PaymentRecord`, `PaymentSummaryDTO`; add `'paid'` to `OrderStatus`; add `Order.paymentId`/`Order.paidAt` | Feature 2 (`DeliveryAddress`, `DeliveryMethodSnapshot`, `Order.deliveryAddress`/`deliveryMethod`), Feature 6 (`'cancelled'` status, `Order.cancelledAt`), Feature 3 (`OrderDTO.total`) | **High** — same interfaces edited by 3+ features; keep additive-only edits, never reorder/rename existing fields |
| `backend/src/repositories/interfaces.ts` / `implementations.ts` | Add `IPaymentRepository`/`InMemoryPaymentRepository` | Feature 2 (`IDeliveryMethodRepository`) | Medium — additive, low overlap risk if each feature appends its own interface/class |
| `backend/src/graphql/schema.ts` | Add `PaymentStatus` enum, `PaymentSummary` type, `CardInput`, `PayResult`, `pay` mutation, `Order.payment` field | Feature 2 (`DeliveryAddressInput`, `submitDeliveryDetails`), Feature 3 (`Order.total`), Feature 6 (`cancelOrder`, `'cancelled'` in `OrderStatus` enum) | **High** — single `type Order` / `Mutation` blocks edited by every feature; coordinate order of PRs, small diffs |
| `backend/src/graphql/resolvers.ts` | Add `Mutation.pay` (no try/catch swallow, per design deviation §3.3) | Feature 2 (`submitDeliveryDetails`), Feature 6 (`cancelOrder`) | Medium — each adds one resolver function; low line-overlap if appended, not interleaved |
| `backend/src/services/orderService.ts` | Read-only dependency: calls `calculateOrderTotal` (Feature 3) inside `PaymentService`, not inside `OrderService` itself; `transformToDTO` gains a `payment` projection call | Feature 3 (`calculateOrderTotal` itself), Feature 2 (`setDeliveryDetails`), Feature 6 (`cancelOrder`, guard on `deleteProductFromOrder`/`updateProductAmount`) | Medium — `transformToDTO` is a single shared method every feature extends; append fields, don't restructure |
| `backend/src/app.ts` | Instantiate `InMemoryPaymentRepository` + `PaymentService` once, pass into both `initializeRoutes()` and `initializeGraphQL()` | The epic-wide dual-repository-instantiation fix (§3.1, flagged as an independent prerequisite task, not owned by any single feature) | **High** — if the prerequisite fix (single-instantiation refactor) hasn't landed yet when this plan's Iteration 2.2 starts, this plan includes the minimal version of that fix scoped to the repos it needs (see Iteration 2.2 note) |
| `backend/src/routes/resetRoutes.ts` | Widen `createResetRoutes` param type so `InMemoryPaymentRepository` can be included in the reset list | Feature 2 (`InMemoryDeliveryMethodRepository`, if it needs reset) | Low — additive, but only one feature should do the signature widening; flagged in Iteration 4.2 |
| `frontend/src/graphql/mutations.ts` | Add `PAY` mutation | Feature 2 (`SUBMIT_DELIVERY_DETAILS`), Feature 6 (`CANCEL_ORDER`) | Low — additive exports |
| `frontend/src/graphql/queries.ts` | Extend `GET_ORDER`/`GET_CURRENT_CART` selection sets to include `payment { ... }` | Feature 1 (`GET_CURRENT_CART` itself), Feature 5 (further extends selection with delivery fields) | Medium — same query object edited by 3 features; append fields to the selection set only |
| `frontend/src/App.tsx` | Add `/checkout/payment` and a stub `/checkout/confirmation/:orderId` route | Feature 1 (route nesting, `PrivateRoute`, `CheckoutProvider` shell), Feature 5 (replaces the confirmation stub with the real page) | Medium — one nested `<Switch>` block; append `<Route>` entries |
| `frontend/src/context/CheckoutContext.tsx` | Read `orderId`/`step` only, no new state added by this feature | Feature 1 (owns the file, defines the reducer) | Low (this plan only reads it) |

**Coordination rule for this plan**: every iteration that touches a shared file makes the smallest possible additive diff (new enum member, new interface, new appended resolver/route/field) and never edits a line owned by another feature's addition. Where an external dependency isn't merged yet, a local fallback stub is used and explicitly flagged `// TODO(feature-N): replace once merged`.

---

## Phase 1 — Backend Payment Data Model & Repository

**After this phase**: the codebase compiles with the new `Payment` types and an in-memory payment repository exists and is unit-tested, with zero behavior change to any existing endpoint. Nothing is wired into GraphQL yet — fully inert from the app's runtime perspective.

### Iteration 1.1 — Add `Payment` types and extend `Order` types in the shared entities file

Depends on: none
Estimate: 1.5h

Files:
- `backend/src/types/entities.ts` (modify)

Changes:
- Add `export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';`
- Add `export interface PaymentRecord { paymentId; orderId; userId; idempotencyKey; method: 'card'; cardNumber; expiry; cvv; cardholderName; amount; status: PaymentStatus; failureReason?; createdAt; updatedAt; }` exactly per tech-design §2.3
- Add `export interface PaymentSummaryDTO { paymentId; status; cardLast4; cardholderName; failureReason?; createdAt; }`
- Widen `OrderRecord.status` / `OrderDTO.status` union to include `'paid'` (additive — do not remove `'created' | 'submited' | 'finished'`; leave a `// 'cancelled' added by feature 6` comment as a merge-order hint, but do not add it yourself)
- Add optional `OrderRecord.paymentId?: string` and `OrderRecord.paidAt?: number`
- Add optional `OrderDTO.payment?: PaymentSummaryDTO`

> Why: `entities.ts` is edited by 4 features concurrently (§ shared files table). Keeping every edit purely additive (new optional fields, new union members) means whichever feature's PR merges first never breaks another's in-flight branch — the type checker only ever gains members, never loses them.

Done criteria:
- [x] `tsc --noEmit` passes in `backend/`
- [x] No existing test/file that constructs an `OrderRecord`/`OrderDTO` literal needs modification (new fields are optional)
- [x] `PaymentRecord`/`PaymentSummaryDTO` shapes match tech-design §2.3 field-for-field

---

### Iteration 1.2 — `IPaymentRepository` interface + `InMemoryPaymentRepository`

Depends on: 1.1
Estimate: 2h

Files:
- `backend/src/repositories/interfaces.ts` (modify)
- `backend/src/repositories/implementations.ts` (modify)
- `backend/src/repositories/__tests__/inMemoryPaymentRepository.test.ts` (create)

Changes:
- `interfaces.ts`: add
  ```ts
  export interface IPaymentRepository {
    findById(paymentId: string): PaymentRecord | undefined;
    findByOrderId(orderId: string): PaymentRecord[];
    findByIdempotencyKey(orderId: string, idempotencyKey: string): PaymentRecord | undefined;
    create(payment: PaymentRecord): void;
    update(payment: PaymentRecord): void;
  }
  ```
- `implementations.ts`: add `export class InMemoryPaymentRepository implements IPaymentRepository` — private array, mirrors `InMemoryOrderRepository`'s shape, plus a `reset(): void` method (empties the array) for parity with the existing test-reset convention

Done criteria:
- [x] Unit test: `create` then `findById` returns the same record
- [x] Unit test: `findByOrderId` returns all attempts for an order, including failed ones (audit-trail requirement, tech-design §2.3)
- [x] Unit test: `findByIdempotencyKey(orderId, key)` returns `undefined` for an unknown key and the correct record for a known `(orderId, key)` pair, and returns `undefined` for a *different* `orderId` even with the same key (keys aren't globally unique)
- [x] Unit test: `reset()` empties the store

---

### Iteration 1.3 — `mockPaymentProvider.ts` (pure deterministic decision function)

Depends on: none (independent of 1.1/1.2 — pure function, no repo/entity dependency beyond a plain string)
Estimate: 1h

Files:
- `backend/src/services/mockPaymentProvider.ts` (create)
- `backend/src/services/__tests__/mockPaymentProvider.test.ts` (create)

Changes:
- `export interface MockPaymentOutcome { outcome: 'succeeded' | 'failed'; failureReason?: string; }`
- `export const MAGIC_DECLINE_CARD_NUMBER = '4000000000000002';`
- `export function evaluateMockPayment(cardNumber: string): MockPaymentOutcome` — strips whitespace, returns `failed` with `failureReason: 'Card declined by issuer (mock)'` iff normalized number equals the magic constant, else `succeeded` — exact logic from tech-design §5

Done criteria:
- [x] Unit test: `evaluateMockPayment('4000000000000002')` → `{ outcome: 'failed', failureReason: 'Card declined by issuer (mock)' }`
- [x] Unit test: `evaluateMockPayment('4000 0000 0000 0002')` (with spaces) → same failed result (normalization works)
- [x] Unit test: `evaluateMockPayment('4242424242424242')` (any other well-formed number) → `{ outcome: 'succeeded' }`
- [x] No I/O, no imports from `repositories/` or `services/` in this file (kept pure per tech-design §4.4 rationale — independently unit-testable)

---

## Phase 2 — `PaymentService` + GraphQL API Surface

**After this phase**: the `pay` GraphQL mutation is callable end-to-end (via Playground/curl) and produces a `paid` order or a `failed` payment attempt per the deterministic rule; idempotent retries and the ownership-check-first fix are both covered by tests. No frontend changes yet — existing UI is unaffected.

### Iteration 2.1 — `PaymentService.pay` / `getSummaryForOrder`

Depends on: 1.1, 1.2, 1.3
Estimate: 3h

Files:
- `backend/src/services/paymentService.ts` (create)
- `backend/src/services/__tests__/paymentService.test.ts` (create)

Changes:
- `export class PaymentService { constructor(private paymentRepository: IPaymentRepository, private orderRepository: IOrderRepository) {} }`
- `async pay(orderId: string, userId: string, idempotencyKey: string, card: { cardNumber: string; expiry: string; cvv: string; cardholderName: string }): Promise<{ order: OrderDTO; payment: PaymentSummaryDTO }>` implementing the exact algorithm from tech-design §5:
  1. **Unconditional ownership check first**: `order = orderRepository.findById(orderId)`; if missing or `order.userId !== userId`, `throw new Error('Order not found or access denied')` — before any idempotency lookup
  2. `lookup = paymentRepository.findByIdempotencyKey(orderId, idempotencyKey)`; if found, return `{ order: <current order DTO>, payment: summary(lookup) }` with no further side effects (replay branch, now ownership-safe because of step 1)
  3. Else: validate `order.status === 'created'` (else throw `'Order cannot be paid in its current status'` — status not specified verbatim in requirements, chosen for consistency with feature 6's error-message style)
  4. Server-side sanity validation on `card` (digits-only after stripping spaces, `cardNumber` 13–19 digits, `cvv` 3–4 digits, `expiry` matches `/^\d{2}\/\d{2}$/`) — throw a validation error otherwise, **before** creating any `PaymentRecord`
  5. `amount = calculateOrderTotal(order.products, order.promo?.id, order.deliveryMethod?.fee ?? 0)` — **note the second argument is `order.promo?.id` (a `string | undefined`), NOT `order.promo` (the `PromoEntity` object)**. This matches Feature 3's real signature (`implementation-plan-03.md`, `calculateOrderTotal(products, promoId: string | undefined, deliveryFee: number)`), which internally calls the existing `calculateOrderSum(products, promoId?: string)`. Passing the full `PromoEntity` object here (an earlier draft's mistake, copied from tech-design §5's stale pseudocode) causes `calculateOrderSum`'s internal `promoRepository.findById(...)` lookup to never match, silently dropping any active discount from the *charged* amount even though Feature 3's review screen shows it correctly — a real overcharge bug caught in plan review. See **external dependency note** below.
  6. Create and persist `PaymentRecord` with `status: 'processing'`, full unmasked card fields, computed `amount`
  7. `result = evaluateMockPayment(card.cardNumber)`
  8. Update the `PaymentRecord` to `succeeded`/`failed`; on success, update the order: `status: 'paid'`, `paymentId`, `paidAt: Date.now()`
  9. Return `{ order: <updated DTO>, payment: summary(record) }`
- `getSummaryForOrder(orderId: string): PaymentSummaryDTO | undefined` — looks up the order's `paymentId` (or latest attempt if none succeeded yet, per §2.3) and returns its masked summary
- Private `private toSummary(payment: PaymentRecord): PaymentSummaryDTO` — masks `cardNumber` to `cardLast4` (last 4 digits), never returns `cvv`/`expiry`/full `cardNumber`

**External dependency — `calculateOrderTotal` (Feature 3)**: if Feature 3's `OrderService.calculateOrderTotal` isn't merged yet when this iteration starts, add a local, clearly-flagged fallback in this same file:
```ts
// TODO(feature-3): remove once OrderService.calculateOrderTotal lands; this is a
// temporary duplicate so PaymentService.pay is independently testable/mergeable.
function fallbackCalculateOrderTotal(products, promoId: string | undefined, deliveryFee: number) { ... same formula, promoId not promo object ... }
```
and call through a single `calculateOrderTotal` reference that's swapped to the real import once available. This keeps `main` shippable regardless of which feature's PR lands first.

> Why (ownership-check-first): this is the exact fix called out in the design review — previously the idempotency-replay branch (step 2) had no ownership check, letting a client that obtained/guessed another user's `idempotencyKey` for a given `orderId` read back that order/payment. Moving the check to step 1, before any branching, closes this uniformly.

Done criteria:
- [x] Unit test: a `pay` call for an order owned by a different user throws `'Order not found or access denied'` even when a matching `idempotencyKey` exists for that order (regression test for the ownership-check-first fix — construct a `PaymentRecord` via the fake repo first, then call `pay` as a different `userId` with the same key, assert it throws rather than replaying)
- [x] Unit test: calling `pay` twice with the same `idempotencyKey` creates exactly one `PaymentRecord` (verify via `findByOrderId` length) and both calls return the same `payment.paymentId`
- [x] Unit test: calling `pay` twice with two *different* `idempotencyKey`s (simulating an explicit retry after failure, AC-404-4) creates two separate `PaymentRecord`s
- [x] Unit test: card number `4000000000000002` → returned `payment.status === 'failed'`, order `status` remains `'created'`
- [x] Unit test: any other well-formed card number → `payment.status === 'succeeded'`, order `status === 'paid'`, `paymentId`/`paidAt` set
- [x] Unit test: malformed card (e.g. `cardNumber: 'abc'`) throws a validation error before any `PaymentRecord` is created (verify `findByOrderId` stays empty after the throw)
- [x] Unit test: `pay` on an order not in `'created'` status (e.g. already `'paid'`) throws without creating a new `PaymentRecord`
- [x] Unit test: `getSummaryForOrder` returns a `cardLast4` (not the full card number) and never includes `cvv`
- [x] Unit test (plan-review M2): `pay` on an order carrying an active, non-expired `promo` produces `payment.amount === (subtotal − discount) + deliveryFee`, matching `calculateOrderTotal`'s own promo fixture from Feature 3 — this is the regression test that would have caught the `order.promo` vs `order.promo?.id` argument bug above at the unit level

---

### Iteration 2.2 — GraphQL schema additions

Depends on: 1.1
Estimate: 1h

Files:
- `backend/src/graphql/schema.ts` (modify)

Changes:
- Add `enum PaymentStatus { pending processing succeeded failed }`
- Add `type PaymentSummary { paymentId: ID! status: PaymentStatus! cardLast4: String! cardholderName: String! failureReason: String createdAt: Float! }`
- Add `input CardInput { cardNumber: String! expiry: String! cvv: String! cardholderName: String! }`
- Add `type PayResult { order: Order! payment: PaymentSummary! }`
- Add `payment: PaymentSummary` field to the existing `type Order { ... }` block
- Add `'paid'` to the existing `enum OrderStatus { ... }` block (additive line only — do not touch `cancelled`, owned by feature 6)
- Add `pay(orderId: ID!, idempotencyKey: String!, card: CardInput!): PayResult!` to the existing `extend type Mutation`/`type Mutation` block

Done criteria:
- [x] GraphQL schema loads without errors (`apolloServer.start()` succeeds locally)
- [x] Introspection query shows `Mutation.pay` with the correct argument/return types
- [x] Existing queries/mutations (`orders`, `order`, `submitOrder`, `deleteProductFromOrder`) are unaffected — diff is purely additive lines

---

### Iteration 2.3 — `Mutation.pay` resolver + service wiring in `app.ts`

Depends on: 2.1, 2.2
Estimate: 2h

Files:
- `backend/src/graphql/resolvers.ts` (modify)
- `backend/src/graphql/server.ts` (modify — `createApolloServer` signature needs `paymentService` passed through)
- `backend/src/app.ts` (modify)

Changes:
- `resolvers.ts`: add to `Mutation`:
  ```ts
  pay: async (parent, { orderId, idempotencyKey, card }, context) => {
    const userId = extractUserIdFromToken(context);
    if (!userId) { throw new Error('Authentication required'); }
    return await paymentService.pay(orderId, userId, idempotencyKey, card);
    // no try/catch swallow — deliberate deviation from the legacy pattern (§3.3):
    // rethrow the original error message unchanged so the frontend can
    // distinguish 'Order not found or access denied' from a validation error
    // from a status error, instead of one generic string.
  }
  ```
- `createResolvers(orderService, authService, promoService, paymentService)` — signature gains a fourth argument (additive, update the one call site in `server.ts`)
- `app.ts`: in **both** `initializeRoutes()` and `initializeGraphQL()`, construct `InMemoryPaymentRepository` and `PaymentService` — if the epic-wide single-instantiation fix (tech-design §3.1) has already landed by the time this iteration starts, add `paymentRepository`/`paymentService` as instance fields alongside the refactored single-instantiation pattern. **If it has not landed yet**, this iteration does the *minimal* version of that fix scoped only to `orderRepository` and the new `paymentRepository` (both must be shared between REST and GraphQL, since `PaymentService.pay` mutates `Order.status` through the same `orderRepository` that REST's `orderController` reads) — promoted to instance fields in the `App` constructor, passed into both `initializeRoutes()` and `initializeGraphQL()`. This does not block or duplicate whichever feature's PR does the full repo-wide fix; if that PR lands first, this iteration's diff shrinks to "just add paymentRepository/paymentService to the existing single-instantiation block."

> Why (rethrow, not swallow): explicitly required by tech-design §3.3 — the legacy try/catch-and-generic-message pattern in this same file would flatten `'Order not found or access denied'`, the sanity-validation error, and the status error into one indistinguishable string, breaking the frontend's ability to render different UI for ownership/validation/decline cases.

Done criteria:
- [x] `pay` mutation callable via GraphQL Playground with a valid JWT and a seeded `created` order; returns `PayResult` with `order.status: 'paid'` for a non-magic card number
- [x] Same call with `4000000000000002` returns `PayResult` with `payment.status: 'failed'`, `order.status: 'created'` (no GraphQL error thrown — confirms §3.3's "decline is not an error" contract)
- [x] Calling `pay` for another user's `orderId` returns the *exact* string `'Order not found or access denied'` in the GraphQL error (not a generic `'Failed to ...'` string) — proves the rethrow fix is in effect
- [x] A mutation made via REST (`/api/order/...`) and one via GraphQL against the same order both see each other's writes (proves the repository-sharing fix is effective for order + payment data)
- [x] Existing `orders`/`order`/`submitOrder`/`deleteProductFromOrder` resolvers unchanged in behavior (regression: existing REST/GraphQL manual smoke test still passes)
- [x] Calling `pay` with no/invalid JWT returns the exact string `'Authentication required'` (plan-review M1 — the only auth-adjacent test previously specified was the ownership check for a *different* user's order, not the no-token-at-all case)

---

## Phase 3 — Frontend Payment UI

**After this phase**: a user who reaches `/checkout/payment` (directly, or via the checkout wizard once features 1–3 are merged) can enter card details, submit, and see all four required states (entering/processing/success/failure), including graceful handling of the chaos 500 and the delay middleware.

### Iteration 3.1 — GraphQL client additions (`PAY` mutation, query field extension)

Depends on: 2.2
Estimate: 0.5h

Files:
- `frontend/src/graphql/mutations.ts` (modify)
- `frontend/src/graphql/queries.ts` (modify)

Changes:
- `mutations.ts`: add
  ```ts
  export const PAY = gql`
    mutation Pay($orderId: ID!, $idempotencyKey: String!, $card: CardInput!) {
      pay(orderId: $orderId, idempotencyKey: $idempotencyKey, card: $card) {
        order { orderId status paymentId }
        payment { paymentId status cardLast4 cardholderName failureReason createdAt }
      }
    }
  `;
  ```
- `queries.ts`: append `payment { paymentId status cardLast4 cardholderName failureReason createdAt }` to whichever order-shaped query this feature reads on mount for the already-paid-order guard (Iteration 3.4) — if `GET_CURRENT_CART` (feature 1) doesn't exist yet, define a minimal local `GET_ORDER_STATUS(orderId)` query here as a fallback, to be superseded once feature 1's query lands (append `status` field only, avoid duplicating the whole query shape)

Done criteria:
- [x] `PAY` mutation compiles against the schema from Iteration 2.2 (codegen/typecheck if configured, else manual Playground copy-paste check)
- [x] Query fallback (if used) returns `{ orderId, status }` for a known order via Playground

---

### Iteration 3.2 — `usePaymentAttempt` state-machine hook

Depends on: 3.1
Estimate: 2h

Files:
- `frontend/src/hooks/usePaymentAttempt.ts` (create)
- `frontend/src/hooks/__tests__/usePaymentAttempt.test.ts` (create, React Testing Library + mocked Apollo)

Changes:
- `type PaymentAttemptState = { phase: 'entering' } | { phase: 'processing' } | { phase: 'success'; order: Order } | { phase: 'failure'; message: string; retryable: true }`
- `export function usePaymentAttempt(orderId: string)` returns `{ state, submit(card: CardInput): Promise<void>, reset(): void }`
- `submit` generates a fresh `crypto.randomUUID()` idempotency key **on every call** (not once per hook instance) so each explicit retry (AC-404-4) is a genuinely new attempt
- Normalizes both failure sources into one `failure` phase:
  - Apollo `onError`/network error (chaos 500, AC-404-5) → `{ phase: 'failure', message: 'Something went wrong processing your payment. Please try again.', retryable: true }`
  - Successful response with `payment.status === 'failed'` (declined card, AC-404-1) → `{ phase: 'failure', message: payment.failureReason ?? 'Payment was declined.', retryable: true }`
  - Successful response with `payment.status === 'succeeded'` → `{ phase: 'success', order }`

Done criteria:
- [x] Test: `submit` transitions `entering → processing → success` for a mocked successful `PAY` response
- [x] Test: `submit` transitions `entering → processing → failure` for a mocked `payment.status: 'failed'` response, with `message` derived from `failureReason`
- [x] Test: `submit` transitions `entering → processing → failure` for a mocked Apollo network error, with the *same* `phase: 'failure'` shape as the declined-card case (verifies AC-404-5's "same failure UI" requirement at the state level)
- [x] Test: two consecutive `submit` calls use two different idempotency keys (spy on the mutation variables passed to Apollo)
- [x] Test: `reset()` returns state to `{ phase: 'entering' }`

---

### Iteration 3.3 — `PaymentForm` component (card entry + client-side validation)

Depends on: none directly (pure form component; wired to the hook in 3.4)
Estimate: 2h

Files:
- `frontend/src/components/checkout/PaymentForm.tsx` (create)
- `frontend/src/components/checkout/__tests__/PaymentForm.test.tsx` (create)

Changes:
- `PaymentForm({ onSubmit: (card: CardInput) => void; disabled: boolean })` — controlled inputs for card number, expiry (`MM/YY`), CVV, cardholder name, all empty on mount (AC-401-1)
- Client-side validation before calling `onSubmit`:
  - Card number: strip spaces, must be digits-only, 13–19 length (AC-401-2)
  - Expiry: `MM/YY` format, and parsed month/year must not be in the past relative to current date (AC-401-3)
  - CVV: 3–4 digits
  - Cardholder name: non-empty
- On any validation failure: inline field-level error text, submit button stays enabled but the click is a no-op (no network call, no partial `PaymentRecord` per tech-design §4.4 edge cases)
- `disabled` prop (driven by `usePaymentAttempt`'s `processing` phase in 3.4) disables all inputs and the submit button

Done criteria:
- [x] Test: rendering with no props shows four empty fields (AC-401-1)
- [x] Test: entering `'123'` as card number and submitting shows a field-level error, `onSubmit` not called (AC-401-2)
- [x] Test: entering an expiry in the past shows a field-level error, `onSubmit` not called (AC-401-3)
- [x] Test: entering all-valid fields and submitting calls `onSubmit` with the exact `CardInput` shape (AC-401-4)
- [x] Test: `disabled={true}` renders all inputs and the submit button as disabled

---

### Iteration 3.4 — `CheckoutPaymentPage` (wiring + already-paid guard) + confirmation-route stub

Depends on: 3.2, 3.3
Estimate: 2.5h

Files:
- `frontend/src/pages/checkout/CheckoutPaymentPage.tsx` (create)
- `frontend/src/pages/checkout/CheckoutConfirmationPage.tsx` (create — **temporary stub**, superseded by feature 5)
- `frontend/src/pages/checkout/__tests__/CheckoutPaymentPage.test.tsx` (create)
- `frontend/src/App.tsx` (modify — add both routes)

Changes:
- `CheckoutPaymentPage`:
  - On mount, reads the order status (via `GET_CURRENT_CART` if feature 1 has landed, else the Iteration 3.1 fallback query) — **if `status === 'paid'`, redirect immediately to `/checkout/confirmation/:orderId`** before rendering `PaymentForm` (guards against back-navigation/deep-linking to a stale payment form, per the design-review fix)
  - Otherwise renders `PaymentForm`, wired to `usePaymentAttempt(orderId)`:
    - `entering` → form enabled
    - `processing` → form disabled, "Processing…" indicator visible (AC-402-1), remains visible for the full 1500ms artificial delay without flicker (AC-402-3)
    - `success` → navigates to `/checkout/confirmation/:orderId`
    - `failure` → renders an error banner with `state.message`, form re-enabled for retry (AC-404-1, AC-404-4), address/delivery selections untouched because they live in already-persisted order state, not local form state (AC-404-3)
  - `orderId` sourced from `CheckoutContext` if feature 1 has landed; else a temporary local `useParams`/prop-drilled `orderId` fallback (flagged `// TODO(feature-1): read from CheckoutContext once merged`)
- `CheckoutConfirmationPage` **stub**: renders `"Payment successful. Order #{orderId}."` and a link back to `/order` — minimal placeholder so the route resolves and `usePaymentAttempt`'s success-path navigation has somewhere real to land; feature 5 replaces this file's contents entirely
- `App.tsx`: add `<Route exact path="/checkout/payment" component={CheckoutPaymentPage} />` and `<Route exact path="/checkout/confirmation/:orderId" component={CheckoutConfirmationPage} />` inside the nested checkout `<Switch>` if feature 1's route-nesting shell (§6.1) already exists; otherwise add both as flat top-level routes for now (not gated by `PrivateRoute`/`CheckoutProvider` yet), flagged `// TODO(feature-1): move inside the nested checkout <Switch> once PrivateRoute/CheckoutProvider land` — this keeps the payment page reachable and independently testable without blocking on feature 1's merge, while making the intended final placement unambiguous for whoever reconciles the routes

Done criteria:
- [x] Test: mounting `CheckoutPaymentPage` for an order already in `status: 'paid'` redirects to `/checkout/confirmation/:orderId` without rendering `PaymentForm` (regression test for the design-review fix)
- [x] Test: mounting for a `status: 'created'` order renders `PaymentForm` in the `entering` state
- [x] Test: submitting a valid, non-magic card transitions through `processing` (button disabled, spinner visible) to navigation toward `/checkout/confirmation/:orderId` (AC-402-1, AC-403-1)
- [x] Test: submitting the magic decline card number renders the failure banner, does not navigate, and a subsequent submit is possible (AC-404-1, AC-404-4)
- [x] Test: simulating an Apollo network error during submit renders the *same* failure banner component/markup as the declined-card case (AC-404-5)
- [x] Manual verification: with the real backend running (1500ms delay + 1-in-5 chaos live), the processing indicator stays visible the whole time and a chaos 500 shows the failure banner, not a blank screen or unhandled exception

---

## Phase 4 — Hardening, Reset Support, Decisions Log

**After this phase**: the feature is fully demoable against a fresh in-memory backend state (test-reset support), and the non-obvious decisions made are recorded per the epic's DoD.

### Iteration 4.1 — Regression test: idempotency + ownership interaction (integration-level)

Depends on: 2.3
Estimate: 1h

Files:
- `backend/src/graphql/__tests__/pay.integration.test.ts` (create)

Changes:
- End-to-end test hitting the Apollo server test client (or `graphql()` executor directly against the schema + real `createResolvers` wiring) covering:
  - Two sequential `pay` calls, same `idempotencyKey`, same user → one `PaymentRecord`, both responses identical
  - A `pay` call with a real `idempotencyKey` from user A's order, replayed with user B's JWT → throws `'Order not found or access denied'`
  - Retrying after a declined-card failure with a fresh key succeeds and produces a second `PaymentRecord` while the order ends up `paid`

Done criteria:
- [x] All three scenarios above pass against the real resolver/service stack (not unit-level mocks) — this is the test that would have caught the original ownership-check gap the design review found
- [x] Test suite runs in CI/local `npm test` without needing a real DB (in-memory repos, matching existing project convention)

---

### Iteration 4.2 — Test-reset support for payment data

Depends on: 1.2
Estimate: 1h

Files:
- `backend/src/routes/resetRoutes.ts` (modify)
- `backend/src/app.ts` (modify)

Changes:
- Widen `createResetRoutes`'s parameter type from `InMemoryOrderRepository[]` to `{ reset(): void }[]` (structural typing — `InMemoryPaymentRepository` already has a compatible `reset()` from Iteration 1.2, no interface change needed beyond the array's declared type)
- `app.ts`: push the `paymentRepository` instance into the same array passed to `createResetRoutes`, so `GET /reset/orders` also clears payment attempts (reusing the existing route rather than adding a new `/reset/payments`, per tech-design §2.4's "fold into existing reset routes" option)

> Why fold into the existing route rather than add `/reset/payments`: fewer moving parts for manual/demo QA (one reset call clears the whole checkout state), and the existing route name is already slightly inaccurate scope-wise (it will also reset delivery-method config once feature 2 lands) — a naming cleanup is out of scope for this plan, flagged as a minor follow-up, not blocking.

Done criteria:
- [x] `GET /reset/orders` empties both the order repository and the payment repository (manual check: pay an order, hit reset, confirm `findByOrderId` for that order returns `[]`)
- [x] Existing behavior (resetting orders alone) unchanged for callers that don't care about payments
- [x] Type-check passes with the widened `createResetRoutes` signature

---

### Iteration 4.3 — `docs/decisions.md` entries for this feature

Depends on: 2.1, 2.3 (decisions reflect final, implemented behavior)
Estimate: 0.5h

Files:
- `docs/decisions.md` (modify — create if it doesn't exist yet from another feature's plan; append, don't overwrite)

Changes:
- Record, per the epic DoD (overview §7, tech-design §7.9):
  1. The deterministic mock-payment rule and the magic decline card number `4000000000000002`, and why it's deterministic rather than random (demoability)
  2. The full-card-persistence deviation from PCI norms (`PaymentRecord` stores unmasked `cardNumber`/`cvv`/`expiry`), the explicit product rationale, and that only the *read-model* (`PaymentSummaryDTO`) masks to last-4
  3. The ownership-check-first placement in `PaymentService.pay` and the vulnerability it closes (idempotency replay without an ownership check)
  4. The `pay` resolver's deliberate deviation from the legacy generic-error-swallowing try/catch pattern

Done criteria:
- [x] All four entries present in `docs/decisions.md` with a date and short rationale, matching the format of any existing entries in that file (if features 1–3's plans already added entries, this iteration appends, doesn't reformat)

---

## Summary — Iteration Count & Total Estimate

| Phase | Iterations | Est. total |
|---|---|---|
| 1 — Data model & repository | 1.1, 1.2, 1.3 | 4.5h |
| 2 — Service & GraphQL API | 2.1, 2.2, 2.3 | 6h |
| 3 — Frontend UI | 3.1, 3.2, 3.3, 3.4 | 7h |
| 4 — Hardening & docs | 4.1, 4.2, 4.3 | 2.5h |
| **Total** | **13 iterations** | **~20h** |

Every iteration leaves `main` buildable and existing behavior (auth, order listing, product listing, promo) untouched — new capability is additive at every step, and any cross-feature dependency that isn't merged yet is bridged with an explicitly flagged, removable fallback stub rather than a blocking wait.
