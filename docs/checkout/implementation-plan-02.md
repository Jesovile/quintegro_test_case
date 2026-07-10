# Implementation Plan — Feature 2: Delivery Address & Method Selection

**Parent requirements**: [`02-delivery-selection.md`](02-delivery-selection.md) (US-201, US-202)
**Technical contract (frozen)**: [`tech-design.md`](tech-design.md) §2 (data model), §3 (GraphQL contract), §4.2 (feature design), §6 (frontend architecture)
**Status**: DRAFT — awaiting plan review (Phase 5)

This plan implements ONLY Feature 2. It assumes Feature 1's scaffolding (`PrivateRoute`, `CheckoutProvider`, the nested `/checkout/*` routes, `currentCart` query) exists on `main` before iteration 2.1 starts — see "Dependency Order" below if it lands out of order.

---

## Dependency Order (cross-feature)

- **Upstream dependency**: Feature 1 must have already merged: `frontend/src/components/PrivateRoute.tsx`, the nested `<Route path="/checkout">` block in `App.tsx` wrapping `CheckoutProvider`, and the `currentCart` GraphQL query/resolver/`OrderService.getCurrentCart`. Feature 2's iterations 2.2+ (frontend) cannot land until that scaffolding exists. Iteration 2.1 (backend delivery-method catalog + `setDeliveryDetails`) has no such dependency and can be built in parallel/first.
- **Prerequisite shared by all features**: the `app.ts` repository-instantiation fix (tech-design §3.1) is a one-time mechanical fix not owned by any single feature. This plan includes it as Iteration 2.0 since Feature 2 is "the first feature that writes new state" (tech-design §7 risk 3) and therefore the natural forcing function to land it — but if another feature's planner lands it first, treat 2.0 as already done and skip it (do not duplicate).
- **Downstream consumer**: Feature 3 (order review, `docs/checkout/03-order-review.md`) depends on this feature's output — specifically that `currentCart`/`GET_ORDER` return a populated `deliveryAddress` + `deliveryMethod`, and that `CheckoutContext.address`/`deliveryMethodType` are set — before its review page can render. Iteration 2.4 (submit mutation + navigation to `/checkout/review`) is the hard dependency boundary Feature 3 waits on.
- **Within this feature**: 2.0 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5, strictly in order (each iteration's Done criteria are load-bearing for the next).

---

## Shared/Cross-Feature Files

These files are touched by Feature 2 AND by other features in the epic. Each entry states exactly what Feature 2 adds so other planners/implementers can merge non-overlapping diffs.

| File | Feature 2 adds | Likely also touched by |
|---|---|---|
| `backend/src/app.ts` | One-time fix: construct each repository once in the constructor, pass same instances to `initializeRoutes()` and `initializeGraphQL()` (tech-design §3.1) — includes wiring the two **new** repos (`IDeliveryMethodRepository`, and stubbing the slot for `IPaymentRepository` if not yet added by Feature 4) | No other feature should need to touch this again once 2.0 lands — flag in PR description that this is the shared prerequisite fix, not feature-2-specific logic |
| `backend/src/types/entities.ts` | `DeliveryAddress`, `DeliveryMethodType`, `DeliveryMethodSnapshot`, `DeliveryMethodOption` interfaces; adds `deliveryAddress?`/`deliveryMethod?` optional fields to `OrderRecord`/`OrderDTO` | Feature 1 (none expected — reads existing fields only), Feature 3 (`total` field on `OrderDTO`), Feature 4 (`PaymentRecord`, `PaymentStatus`, `PaymentSummaryDTO`, `paymentId`/`paidAt` on `OrderRecord`), Feature 6 (`cancelled` status value, `cancelledAt`) — **Feature 2 does NOT touch `OrderStatus` enum, `Payment*` types, or `total`; those are other features' additions to the same file** |
| `backend/src/graphql/schema.ts` | `DeliveryMethodType` enum, `DeliveryAddress` type, `DeliveryMethodOption` type, `DeliveryMethodSnapshot` type, `DeliveryAddressInput` input, adds `deliveryAddress`/`deliveryMethod` fields to `Order` type, adds `Query.deliveryMethods`, adds `Mutation.submitDeliveryDetails` | Feature 1 (`Query.currentCart`), Feature 3 (`Order.total`), Feature 4 (`PaymentStatus` enum, `PaymentSummary` type, `CardInput`, `PayResult`, `Mutation.pay`, `Order.payment`), Feature 6 (`cancelled` in `OrderStatus` enum, `Mutation.cancelOrder`) — **edit the existing single-file blocks in place per tech-design §3.2 note; do not create a competing schema file** |
| `backend/src/graphql/resolvers.ts` | `Query.deliveryMethods`, `Mutation.submitDeliveryDetails` — both follow the "rethrow original error, do not swallow into generic string" pattern mandated by tech-design §3.3 for the three new checkout resolvers | Feature 1 (`Query.currentCart`), Feature 4 (`Mutation.pay`), Feature 6 (`Mutation.cancelOrder`) — all three new resolvers (this feature's `submitDeliveryDetails` + the other two) share the same "rethrow, don't swallow" deviation; keep them consistent if reviewing together |
| `backend/src/repositories/interfaces.ts` / `implementations.ts` | New `IDeliveryMethodRepository` interface + `InMemoryDeliveryMethodRepository` class (seeded with Regular/Extra) | Feature 4 adds `IPaymentRepository`/`InMemoryPaymentRepository` in the same files — additive, no conflict expected since each feature adds a distinct interface+class pair |
| `backend/src/services/orderService.ts` | `setDeliveryDetails(orderId, userId, address, methodType)` method added to existing `OrderService`; `transformToDTO` extended to project `deliveryAddress`/`deliveryMethod` | Feature 3 (`calculateOrderTotal`, `total` in `transformToDTO`), Feature 4 (`transformToDTO` also projects `payment`), Feature 6 (`cancelOrder`, and the mandatory `status === 'created'` guard added to `deleteProductFromOrder`/`updateProductAmount`) — **Feature 2 does not touch `deleteProductFromOrder`/`updateProductAmount`/`calculateOrderSum`, those are Feature 3/6's additions to the same file** |
| `frontend/src/App.tsx` | No change expected if Feature 1 already added the nested `/checkout/*` `<Switch>` — `CheckoutAddressPage` slots into the existing `<Route exact path="/checkout/address">` entry. If Feature 1 hasn't landed yet, Iteration 2.2 must add the minimal routing stub itself (see Iteration 2.2 note) | Feature 1 (owns the route/PrivateRoute scaffolding), Feature 3/4/5 (their own route entries in the same `<Switch>`) |
| `frontend/src/context/CheckoutContext.tsx` | Reads/writes `address: DeliveryAddress \| null` and `deliveryMethodType: DeliveryMethodType \| null` fields of `CheckoutState`; `step` transitions `'address' → 'review'` | Feature 1 (creates the file + `orderId`/`step` skeleton), Feature 3/4 (`step: 'payment' | 'confirmation'` transitions, reading `address`/`deliveryMethodType` back out) — **Feature 2 does not redefine `CheckoutState`, only populates two of its fields that Feature 1's skeleton must already declare per tech-design §6.2** |
| `frontend/src/graphql/queries.ts` | Adds `GET_DELIVERY_METHODS`, `GET_CURRENT_CART` (if not already added by Feature 1) | Feature 1 may add `GET_CURRENT_CART` first — if so, Feature 2 iteration 2.2 just imports it, does not re-declare |
| `frontend/src/graphql/mutations.ts` | Adds `SUBMIT_DELIVERY_DETAILS` | Feature 4 (`PAY`), Feature 6 (`CANCEL_ORDER`) — additive, no conflict |
| `frontend/src/components/OrderListItem.tsx` | None expected — Feature 1 owns the "Proceed to Checkout" button swap (tech-design §6.5) | Feature 1, Feature 6 (splits into `OrderListItem`/`OrderHistoryItem`) |

**Bottom line for merge coordination**: Feature 2 owns `DeliveryAddress`/`DeliveryMethod*` types, `deliveryMethods` query, `submitDeliveryDetails` mutation, and the address/method frontend components. It reads but does not redefine `CheckoutState`, `PrivateRoute`, or the routing skeleton (Feature 1's), and does not touch `total`/`Payment*`/`cancelOrder` (Features 3/4/6's).

---

## Phase 1 — Backend delivery capability (catalog + persistence)

**After this phase**: the `deliveryMethods` query and `submitDeliveryDetails` mutation work end-to-end via GraphQL Playground/curl — a client can fetch the two delivery options and attach an address+method to a `created` order, and see it persist (verifiable via a follow-up `currentCart`/`order` query or REST `orderRoutes.ts` GET, confirming the app.ts repo-split fix works). No frontend UI yet.

**Iterations**: 2.0, 2.1

### Iteration 2.0 — ~~Fix the REST/GraphQL dual-repository instantiation bug~~ (SUPERSEDED — verify only)

**STATUS: already implemented by Feature 1 (iteration 1.1), landed 2026-07-10.** Plan-review flagged this iteration as an exact duplicate of `implementation-plan-01.md`'s iteration 1.1, both editing the same lines of `backend/src/app.ts` with no arbitration. Feature 1 is the canonical owner (it was scheduled and implemented first). Do NOT re-apply this fix.

Depends on: none
Estimate: 5 min (verification only)

Changes: none — verification only.

Done criteria:
- [x] `grep -n "new InMemory" backend/src/app.ts` shows each repository class instantiated exactly once (already true as of Feature 1's implementation)
- [x] If for any reason it is NOT already fixed, stop and escalate rather than re-implementing independently — check with the Feature 1 implementer first

---

### Iteration 2.1 — Delivery method catalog + `setDeliveryDetails` service method + GraphQL surface

Depends on: 2.0
Estimate: 3h

Files:
- `backend/src/types/entities.ts` (modify)
- `backend/src/repositories/interfaces.ts` (modify)
- `backend/src/repositories/implementations.ts` (modify)
- `backend/src/services/orderService.ts` (modify)
- `backend/src/graphql/schema.ts` (modify)
- `backend/src/graphql/resolvers.ts` (modify)
- `backend/src/app.ts` (modify — wire the new repository instance)

Changes:
- `entities.ts`: add `DeliveryAddress`, `DeliveryMethodType`, `DeliveryMethodSnapshot`, `DeliveryMethodOption` interfaces exactly as specified in tech-design §2.1/§2.2 (verbatim field names/types — do not deviate, this is the frozen contract). Add `deliveryAddress?: DeliveryAddress` and `deliveryMethod?: DeliveryMethodSnapshot` as optional fields on `OrderRecord` and `OrderDTO`.

  > Why optional: legacy seed orders (`order-1`, `order-2`) and any order that hasn't reached the delivery step won't have these fields — matches tech-design §2.1 comment verbatim.

- `interfaces.ts`: add
  ```ts
  export interface IDeliveryMethodRepository {
    findAll(): DeliveryMethodOption[];
    findByType(type: DeliveryMethodType): DeliveryMethodOption | undefined;
  }
  ```
- `implementations.ts`: add `InMemoryDeliveryMethodRepository` seeded with two fixed options — Regular (`fee: 5.99`, `estimatedDays: '3-5'`) and Extra (`fee: 14.99`, `estimatedDays: '1-2'`) per tech-design §2.2 placeholder values (flagged for product confirmation — see Done criteria note below)
- `orderService.ts`: add method
  ```ts
  setDeliveryDetails(orderId: string, userId: string, address: DeliveryAddress, methodType: DeliveryMethodType): Promise<OrderDTO | null>
  ```
  — validates `order.userId === userId` and `order.status === 'created'` (else return `null`, caller/resolver throws `'Order not found or access denied'`); looks up fee/estimatedDays snapshot via `IDeliveryMethodRepository.findByType`; writes `deliveryAddress` and `deliveryMethod` onto the order record; returns the transformed `OrderDTO`. Extend `transformToDTO` to project `deliveryAddress`/`deliveryMethod` onto the DTO (pass-through, no computation).
- `schema.ts`: add `DeliveryMethodType` enum, `DeliveryAddress` type, `DeliveryMethodOption` type, `DeliveryMethodSnapshot` type, `DeliveryAddressInput` input; add `deliveryAddress`/`deliveryMethod` fields to existing `Order` type; add `deliveryMethods: [DeliveryMethodOption!]!` to `Query`; add `submitDeliveryDetails(orderId: ID!, address: DeliveryAddressInput!, deliveryMethodType: DeliveryMethodType!): Order!` to `Mutation` — edit existing blocks in place per tech-design §3.2 note (no `extend type` syntax).
- `resolvers.ts`: add
  - `Query.deliveryMethods` — requires auth (`extractUserIdFromToken`), returns `deliveryMethodRepository.findAll()`
  - `Mutation.submitDeliveryDetails` — requires auth, calls `orderService.setDeliveryDetails(...)`; **no try/catch that swallows the error** — either omit try/catch or `catch (e) { throw e; }` per tech-design §3.3's mandated deviation for the three new checkout resolvers, so `'Order not found or access denied'` reaches the client verbatim
- `app.ts`: instantiate `InMemoryDeliveryMethodRepository` once (alongside the other repos from 2.0), pass into `OrderService` constructor and into the GraphQL context/resolver wiring

Done criteria:
- [x] `deliveryMethods` query returns exactly 2 items with `type`, `label`, `fee`, `estimatedDays` populated, when called with a valid JWT
- [x] `deliveryMethods` query throws `'Authentication required'` when called with no/invalid token
- [x] `submitDeliveryDetails` mutation on a `created`-status order owned by the caller returns an `Order` with `deliveryAddress` matching input and `deliveryMethod` matching the looked-up catalog snapshot (fee/estimatedDays copied from catalog, not from client input — client only sends `deliveryMethodType`)
- [x] `submitDeliveryDetails` on an order not owned by the caller (or non-existent orderId) throws `'Order not found or access denied'` (exact string, unswallowed)
- [x] `submitDeliveryDetails` on an order with `status !== 'created'` also throws `'Order not found or access denied'` (per tech-design §3.3 table — same wording reused for the status-mismatch case, no separate string defined for this feature)
- [x] Unit test: `OrderService.setDeliveryDetails` returns `null` for wrong-owner and wrong-status cases (service-level, not just resolver-level)
- [x] Unit test: `InMemoryDeliveryMethodRepository.findByType('regular')`/`findByType('extra')` return the seeded snapshot; `findByType` with an invalid value returns `undefined`
- [x] `docs/decisions.md` gets an entry noting the placeholder fee/day values ($5.99/3-5 days Regular, $14.99/1-2 days Extra) are unconfirmed pending product sign-off (per tech-design §7 risk 1) — a one-line addition, not a new doc

---

## Phase 2 — Frontend delivery step (form, method picker, wizard integration)

**After this phase**: a logged-in user with items in their cart can navigate to `/checkout/address`, fill in the address form, pick Regular or Extra, see client-side validation block invalid submissions, submit successfully, and land on `/checkout/review` (even if that page is just a placeholder from Feature 3's perspective — this feature's Done criteria stop at "the mutation fired and navigation occurred"). Back-navigation to `/checkout/address` preserves entered values.

**Iterations**: 2.2, 2.3, 2.4

### Iteration 2.2 — GraphQL client wiring + `DeliveryAddressForm` component (address half only)

Depends on: 2.1 (backend contract must exist to know the exact fields/types), Feature 1's `PrivateRoute`/`CheckoutProvider`/routing scaffolding (external dependency — see note)

> Note on the external dependency: if Feature 1 has not yet merged its routing/`CheckoutContext` skeleton when this iteration starts, add a minimal local stub instead of blocking — a bare `<Route exact path="/checkout/address" component={CheckoutAddressPage} />` with no auth guard, and a local `useState`-based stand-in for the two `CheckoutContext` fields this feature needs. Flag the stub clearly with a `// TODO(feature-1): replace with PrivateRoute/CheckoutContext` comment so it's trivially replaced once Feature 1 lands, and add Iteration 2.5 (below) to formally reconcile. Do not invent a different context shape — match `CheckoutState` from tech-design §6.2 exactly so the swap is a no-op.

Estimate: 3h

Files:
- `frontend/src/graphql/queries.ts` (modify — Feature 1 already declares `GET_CURRENT_CART` with a `product { id title }` selection (`title` is the real `ProductRecord` field per `backend/src/types/entities.ts:23` — NOT `name`). Extend that existing constant's selection set with `deliveryAddress { ... } deliveryMethod { ... }`; do not redeclare a second `GET_CURRENT_CART`. Add `GET_DELIVERY_METHODS` as a new constant.)
- `frontend/src/graphql/mutations.ts` (modify — add `SUBMIT_DELIVERY_DETAILS`)
- `frontend/src/components/checkout/DeliveryAddressForm.tsx` (create)
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (modify — Feature 1 already created this file with real empty-cart/found-cart branching and error/retry handling; replace only the "found-cart placeholder" block with `DeliveryAddressForm`, method picker added in 2.3. Do not recreate the file or its existing branches.)

Changes:
- `queries.ts`: add `GET_DELIVERY_METHODS`; EXTEND the existing `GET_CURRENT_CART` (already declared by Feature 1, selecting `products { product { id title } amount price }` — `title`, not `name`, per `backend/src/types/entities.ts:23`) with `deliveryAddress { recipientName phone country city street building apartment postalCode }` and `deliveryMethod { type fee estimatedDays }` fields. Do not redeclare the constant.
  ```ts
  export const GET_DELIVERY_METHODS = gql`query GetDeliveryMethods { deliveryMethods { type label fee estimatedDays } }`
  ```
- `mutations.ts`: add
  ```ts
  export const SUBMIT_DELIVERY_DETAILS = gql`mutation SubmitDeliveryDetails($orderId: ID!, $address: DeliveryAddressInput!, $deliveryMethodType: DeliveryMethodType!) { submitDeliveryDetails(orderId: $orderId, address: $address, deliveryMethodType: $deliveryMethodType) { orderId deliveryAddress { recipientName phone country city street building apartment postalCode } deliveryMethod { type fee estimatedDays } } }`
  ```
- `DeliveryAddressForm.tsx`: controlled form component, props `{ value: DeliveryAddress; onChange: (v: DeliveryAddress) => void; errors: Partial<Record<keyof DeliveryAddress, string>> }`. Fields: recipientName, phone, country, city, street, building, apartment (optional), postalCode. Renders inline error text under each field when `errors[field]` is set. No internal state — fully controlled by parent so `CheckoutAddressPage`/`CheckoutContext` owns the values (needed for AC-201-5 back-nav preservation).
- `CheckoutAddressPage.tsx`: Feature 1 already implements the `GET_CURRENT_CART` fetch, loading/error/retry, and empty-cart/found-cart branching (including `orderId` dispatch into `CheckoutContext`). Do not re-fetch or re-derive these branches — only replace the "found-cart placeholder" `<div>` with `DeliveryAddressForm` wired to `CheckoutContext` state.

Done criteria:
- [x] `CheckoutAddressPage` renders 6 required empty fields + 1 optional field on first load (AC-201-1)
- [x] Typing into a field updates the controlled value and is reflected back in the input (round-trip test via React Testing Library)
- [x] Component test: passing an `errors` prop with `{ phone: 'Invalid format' }` renders that message next to the phone field only
- [x] No network call fires until explicit submit (form is purely local up to this iteration — submit button not yet wired, added in 2.4)

---

### Iteration 2.3 — `DeliveryMethodPicker` component + client-side validation

Depends on: 2.2
Estimate: 2h

Files:
- `frontend/src/components/checkout/DeliveryMethodPicker.tsx` (create)
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (modify — integrate picker, add validation)

Changes:
- `DeliveryMethodPicker.tsx`: props `{ options: DeliveryMethodOption[]; selected: DeliveryMethodType | null; onSelect: (type: DeliveryMethodType) => void }`. Renders `GET_DELIVERY_METHODS` results as two selectable cards/radio options, each showing `label`, `fee` (currency-formatted, reuse `OrderSum`'s formatting convention per tech-design §4.3 note), and `estimatedDays` (e.g. "3-5 days"). No default selection — `selected` starts `null`, matching AC-202-2's "no silent default."
- `CheckoutAddressPage.tsx`:
  - runs `useQuery(GET_DELIVERY_METHODS)`, passes `data.deliveryMethods` into `DeliveryMethodPicker`
  - adds a `validate(address, methodType): Record<string, string>` pure function: required-field-empty check on all fields except `apartment`; phone format check (regex, e.g. `/^\+?[0-9\s\-()]{7,20}$/` — reasonable phone-shape validation per AC-201-3, not exhaustive international validation); returns error map
  - submit button (still just logs/no-ops the mutation call in this iteration — wired in 2.4) is `disabled` when `methodType === null` (AC-202-2) or when `validate()` returns any errors

Done criteria:
- [x] `DeliveryMethodPicker` renders exactly 2 options (Regular, Extra) each with visible price and estimated-days text (AC-202-1)
- [x] Selecting "Extra" then "Regular" updates `selected` correctly (component test simulating two clicks)
- [x] Submit button is disabled when no method is selected, even with a fully valid address (AC-202-2)
- [x] Submit button is disabled when a required field is empty (AC-201-2) — test each of the 6 required fields individually
- [x] Submit button is disabled for a malformed phone (e.g. `"abc"`, `"123"`) and enabled for a well-formed one (AC-201-3) — parametrized test with 2+ invalid and 1+ valid phone strings
- [x] Submit button is enabled when apartment is left empty but everything else is valid (confirms apartment is genuinely optional)

**AC-202-3/4/5 ownership note (plan-review finding B1)**: `02-delivery-selection.md`'s AC-202-3/4/5 (selecting a method updates the *displayed total*) are explicitly NOT implemented on this delivery step — no running total is shown here. Per the AC's own wording ("on this step or the next"), ownership is assigned to Feature 3's order review screen, which renders the server-computed `Order.total` (including the selected `deliveryMethod.fee`) immediately after this step. `implementation-plan-03.md` must explicitly claim AC-202-3/4/5 in its traceability table, not just AC-301-x.

---

### Iteration 2.4 — Wire submit mutation, CheckoutContext integration, navigation to review

Depends on: 2.3
Estimate: 2.5h

Files:
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (modify — final integration)
- `frontend/src/context/CheckoutContext.tsx` (modify, or create as local stub per 2.2's note if Feature 1 hasn't landed — see Iteration 2.5)

Changes:
- `CheckoutAddressPage.tsx`: on submit, calls `useMutation(SUBMIT_DELIVERY_DETAILS, { variables: { orderId, address, deliveryMethodType } })`. On success: writes `address`/`deliveryMethodType` into `CheckoutContext` (`dispatch({ type: 'SET_DELIVERY', address, deliveryMethodType })` or equivalent reducer action), sets `step: 'review'`, navigates via `history.push('/checkout/review')`. On error: renders an error banner with the thrown message (`'Order not found or access denied'` or a network/chaos-500 error) and stays on the address step — does not navigate, does not clear the form (tech-design §4.2 sequence diagram).
- On mount: if `CheckoutContext.address`/`deliveryMethodType` are already populated (non-null) — e.g. user navigated back from `/checkout/review` — pre-fill `DeliveryAddressForm`/`DeliveryMethodPicker` from context state instead of blank fields (AC-201-5).
- `CheckoutContext.tsx`: if this is the first feature to touch the file (Feature 1 hasn't landed CheckoutContext yet), create it now with the full `CheckoutState` shape from tech-design §6.2 (`orderId`, `address`, `deliveryMethodType`, `step`) — even though `orderId`/`step`-for-other-steps technically "belong" to Feature 1, declaring the complete shape up front avoids a second breaking edit. If Feature 1's file already exists, only add/confirm the reducer action(s) that set `address`/`deliveryMethodType`.

Done criteria:
- [x] Submitting a valid form fires `SUBMIT_DELIVERY_DETAILS` with correct variables (mock Apollo test, assert mutation called with exact address object + methodType)
- [x] On mutation success, test asserts `history.push` was called with `/checkout/review` and `CheckoutContext` state contains the submitted `address`/`deliveryMethodType`
- [x] On mutation error (mocked GraphQL error `'Order not found or access denied'`), test asserts an error banner renders with that text and `history.push` was NOT called
- [x] Test: render `CheckoutAddressPage` with `CheckoutContext` pre-populated (`address`/`deliveryMethodType` non-null) — form fields and picker selection show those values on first render, not blank (AC-201-5)
- [x] Manual verification end-to-end (per project's no-CI/no-DB constraint): start backend + frontend, log in, go to `/checkout/address`, fill form, pick "Extra", submit, confirm redirect to `/checkout/review` (blank/placeholder page is fine if Feature 3 hasn't landed) and confirm via GraphQL Playground `currentCart` query that `deliveryAddress`/`deliveryMethod` are persisted on the order

---

## Phase 3 — Reconciliation (only needed if built ahead of Feature 1)

**After this phase**: if Feature 2 was implemented before Feature 1 landed its real `PrivateRoute`/`CheckoutProvider`/routing, this phase removes the temporary stubs and confirms Feature 2's components work unmodified under the real scaffolding — leaving `main` fully consistent with tech-design §6.1/§6.2 for all features.

**Iterations**: 2.5 (conditional — skip entirely if Feature 1 landed first, per the note in 2.2)

### Iteration 2.5 — Replace local stub routing/context with Feature 1's real `PrivateRoute`/`CheckoutProvider`

Depends on: 2.4, Feature 1 merged
Estimate: 1h

Files:
- `frontend/src/App.tsx` (modify — remove temporary bare `<Route>`, use Feature 1's nested structure)
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (modify — swap stub context import for real `CheckoutContext`, if the reducer action names differ)
- `frontend/src/context/CheckoutContext.tsx` (modify — merge Feature 2's stub reducer actions into Feature 1's canonical file if both were created independently; delete the stub file)

Changes:
- Delete the `// TODO(feature-1)` stub context/routing added in 2.2/2.4
- Re-point `CheckoutAddressPage` at the real `CheckoutContext` hook/provider
- Confirm route nesting matches tech-design §6.1 exactly (single `<Route path="/checkout">` → `PrivateRoute` → `CheckoutProvider` → nested `<Switch>`)

Done criteria:
- [ ] All Done criteria from Iteration 2.2, 2.3, 2.4 re-verified passing against the real Feature 1 scaffolding (re-run existing test suite, no new tests needed if behavior is unchanged)
- [ ] Unauthenticated user hitting `/checkout/address` directly is redirected to `/login` (confirms `PrivateRoute` is now actually wired, not the 2.2 stub's no-op)
- [ ] Navigating `/checkout/address` → `/checkout/review` → back to `/checkout/address` (browser back button) preserves form values via the real, shared `CheckoutProvider` instance (confirms single-instance-across-navigation behavior from tech-design §6.1, not just the stub's local `useState`)

---

## Summary Table

| Iteration | Phase | Depends on | Estimate | Files touched (count) |
|---|---|---|---|---|
| 2.0 | 1 | none | 1h | 1 |
| 2.1 | 1 | 2.0 | 3h | 7 |
| 2.2 | 2 | 2.1, Feature 1 (or stub) | 3h | 4 |
| 2.3 | 2 | 2.2 | 2h | 2 |
| 2.4 | 2 | 2.3 | 2.5h | 2 |
| 2.5 | 3 | 2.4, Feature 1 merged | 1h | 3 (conditional) |

**Total estimate**: 11.5h core (2.0–2.4) + 1h conditional reconciliation (2.5) = up to 12.5h.
