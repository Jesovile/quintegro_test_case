# Implementation Plan — Feature 5: Order Confirmation & Order History Update

**Parent requirements**: [`05-order-confirmation-and-history.md`](05-order-confirmation-and-history.md)
**Technical contract**: [`tech-design.md`](tech-design.md) §4.5 (feature section), §4.6/§6.5 (mandatory `OrderListItem`/`OrderHistoryItem` split + backend guard), §6.4 (`CurrentOrder` rewrite), §2 (frozen data model — not renegotiated here)
**Planning scope**: Feature 5 only. Features 1–4 and 6 are planned separately against the same tech-design.md; see "Shared/Cross-Feature Files" below for where this plan's iterations touch files other planners also touch.

---

## 0. Position in the epic dependency order

- **Feature 5 depends on Feature 4** (`04-online-payment.md` / tech-design §4.4): a `pay` mutation must exist and must be able to move an order from `created` → `paid` before there is anything to confirm or list as history. Feature 5 has nothing to render without a successful `PayResult`.
- **Feature 5 also depends transitively on**:
  - Feature 1 (`currentCart` query, `PrivateRoute`, `/checkout` route shell, `CheckoutContext`) — tech-design §4.1 introduces `currentCart`, which Feature 5 reuses (does not re-introduce) for the `CurrentOrder` header fix (§6.4).
  - Feature 2 (`deliveryAddress`/`deliveryMethod` on `Order`) and Feature 3 (`total` field, `calculateOrderTotal`) — Feature 5 only *displays* these fields, it does not define them (§2 is frozen).
- **Feature 6 (cancellation) builds directly on top of this feature's output**: the new `OrderHistoryItem.tsx` component and the "paid/cancelled orders render via history component, not the cart-editing component" split introduced here are exactly what Feature 6 extends (it adds the "Cancel Order" button into `OrderHistoryItem.tsx` and a `cancelOrder` mutation call). Feature 6 planners should treat `OrderHistoryItem.tsx` as owned-and-created by this plan, then additive from their side.

**Baseline assumption for this plan** (stated explicitly since features are planned concurrently against one frozen data model, not built in strict serial order): by the time these iterations are implemented, the GraphQL schema/type additions in tech-design §2–§3 (`OrderStatus` gains `paid`/`cancelled`, `Order.deliveryAddress`/`deliveryMethod`/`payment`/`total`, `Query.currentCart`, `Mutation.pay`) already exist on `main`, landed by Features 1–4. If any iteration below is picked up before that is true, its "Done criteria" degrade gracefully to "renders correctly against whatever subset of fields the schema currently exposes, no crash on missing fields" — every new field this feature reads (`deliveryAddress`, `deliveryMethod`, `payment`, `total`) is optional/nullable in the schema per §2.1, so partial rollout does not break rendering.

---

## 1. Shared / Cross-Feature Files

Files this feature's iterations touch that other concurrently-planned features also touch. Flagged so merges are reviewed, not surprised by.

| File | Also touched by | Nature of overlap |
|---|---|---|
| `backend/src/services/orderService.ts` | Feature 2 (`setDeliveryDetails`), Feature 4 (amount/status writes via `PaymentService`), Feature 6 (`cancelOrder`) | Feature 5 adds a guard clause (`status === 'created'` check) to the *existing* `deleteProductFromOrder`/`updateProductAmount` methods only — additive, small diff, but this is a hot file; rebase/merge order matters. Feature 5's guard should land independent of and before Feature 6's `cancelOrder` addition to the same file where possible. |
| `frontend/src/components/OrderList.tsx` | Feature 6 (passes a cancel handler down once `OrderHistoryItem` exists) | Feature 5 changes the render branch (`status === 'created'` → `OrderListItem`, else → `OrderHistoryItem`) and the sort order. Feature 6 will only add a prop/handler pass-through afterward — no expected logic conflict if this feature lands first (it must, per §0). |
| `frontend/src/components/OrderListItem.tsx` | none expected after this feature (Feature 6 works exclusively in `OrderHistoryItem.tsx` per tech-design §4.6) | Feature 5 trims this file down to `created`-only rendering (removes the now-dead `status !== 'created'` code paths it never actually needed but currently has no guard against). Feature 1 also touches this file (replaces "Submit Order" button with "Proceed to Checkout") — coordinate on the same diff region (the bottom conditional button block). |
| `frontend/src/components/OrderHistoryItem.tsx` | Feature 6 (adds "Cancel Order" button + `cancelOrder` mutation call) | **New file, created by this feature.** Feature 6 is additive on top; Feature 6 planners should not redefine its read-only rendering contract. |
| `frontend/src/components/CurrentOrder.tsx` | none expected (owned end-to-end by this feature per tech-design §4.5/§6.4) | Sole owner; only dependency is that `GET_CURRENT_CART`/`currentCart` (Feature 1) exists. |
| `frontend/src/graphql/queries.ts` | Feature 1 (`GET_CURRENT_CART`, `GET_DELIVERY_METHODS`), Feature 2/3/4 (field selection extensions on `GET_ORDER`) | Feature 5 extends `GET_ORDERS`/`GET_ORDER` selections with `deliveryAddress`, `deliveryMethod`, `payment`, `total`. If Feature 1's `GET_CURRENT_CART` isn't present yet when this feature's iteration 5.5 lands, this feature adds it defensively (idempotent — whichever PR merges first "wins", the other rebases with no logic conflict since it's a pure query-string addition). |
| `frontend/src/pages/OrderPage.tsx` | Feature 1 (empty-cart messaging path, AC-102-2/3) | Feature 5 does not change this file directly (all changes are inside `OrderList`), but Feature 1's empty-state work and this feature's AC-502-3 empty-cart-after-purchase requirement render through the same component — verify together in iteration 5.6. |
| `frontend/src/App.tsx` | Feature 1 (route shell, `PrivateRoute`, `CheckoutProvider`), Feature 2/3/4 (address/review/payment routes) | Feature 5 adds the `/checkout/confirmation/:orderId` route entry inside the existing nested `<Switch>` from tech-design §6.1. If Features 1–4 have already scaffolded the full nested route block, this is a one-line addition; if not, this feature stubs the full block per §6.1 rather than block on other features (see iteration 5.4). |

Files this feature owns exclusively (lowest merge risk): `frontend/src/pages/checkout/CheckoutConfirmationPage.tsx` (modify — Feature 4 iteration 3.4 creates a temporary stub at this path; this feature replaces its contents entirely, create only if Feature 4 has not landed yet), `frontend/src/components/OrderHistoryItem.tsx` (new, though extended later by Feature 6).

---

## Phases

```
Phase 1 — Read-only order history & security fix
After this phase: paid/cancelled orders in the order list can no longer have their line items edited or deleted from the UI or directly via GraphQL — closing the security gap identified in design review — and each order card shows delivery/payment detail. Ships independently of Feature 4 being complete (works against whatever orders already exist, including today's seed data).
Iterations: 5.1, 5.2, 5.3

Phase 2 — Confirmation page & live cart indicator
After this phase: a user who completes payment (Feature 4) lands on a real confirmation page showing order id/items/address/method/total, and the header cart icon reflects true cart state instead of the localStorage stub. Requires Feature 4's `pay` mutation to exist for end-to-end manual verification, but the components themselves compile and render standalone.
Iterations: 5.4, 5.5

Phase 3 — Edge cases & full AC closure
After this phase: all US-501/502/503 acceptance criteria pass manually, including the abandoned-cart-alongside-paid-orders edge case and most-recent-first ordering.
Iterations: 5.6
```

---

## Iteration 5.1 — Backend guard: block editing non-`created` orders

**Ownership note (plan-review B1 fix)**: this iteration is the sole, canonical owner of this guard. `implementation-plan-06.md`'s original iteration 6.2 independently specified the identical change to the same file/methods/error string — that was a real duplication caught in plan review; plan-06's 6.2 has since been rewritten as a verification-only step that defers to this iteration. Do not let Feature 6's implementer re-apply this guard.

Depends on: none
Estimate: 1h
Rollback: revert only the two added `if` blocks (no other lines in these methods change); do not revert the whole file given concurrent edits from Features 2/4/6 landing around the same time. If reverted, the security gap (any user can edit a paid/cancelled order's line items via GraphQL Playground) re-opens immediately — treat a rollback as needing a same-day forward-fix, not deferred cleanup.

Files:
- `backend/src/services/orderService.ts` (modify)

Changes:
- `deleteProductFromOrder(orderId, productId, userId)`: after the existing `order.userId !== userId` ownership check, add `if (order.status !== 'created') { throw new Error('Order cannot be modified in its current status'); }` before the products mutation.
- `updateProductAmount(orderId, productId, newAmount, userId)`: same guard, same error message, added in the same position (after ownership check, before mutation).

> Why: tech-design §4.6 elevated this from "recommended" to "mandatory" — design review found that GraphQL Playground lets any authenticated user call these two mutations directly on their own `paid`/`cancelled` order and edit line items post-payment, contradicting "no order editing after payment." Hiding UI controls (iteration 5.2) is necessary but not sufficient on its own; the backend guard is the actual security fix. Landing it as its own iteration, ahead of the UI split, means the fix is real even if the UI iteration slips.

Done criteria:
- [x] Calling `deleteProductFromOrder` on an order with `status: 'paid'` (or `'cancelled'`, or `'submited'`/`'finished'`) throws `'Order cannot be modified in its current status'` and does not mutate `order.products`
- [x] Calling `updateProductAmount` on the same non-`created` statuses throws the same error and does not mutate
- [x] Both methods still succeed unchanged for `status: 'created'` orders (no regression — existing cart-editing flow still works)
- [x] Unit test: `orderService.test.ts` (new or extended) covers both methods × all four currently-existing non-`created` `OrderStatus` values (`submited`/`finished`/`paid` — `cancelled` does not exist on `OrderStatus` yet, it's Feature 6's addition; the guard code already covers it by construction, only test coverage is deferred), asserting throw for everything except `'created'`
- [ ] Manual check via GraphQL Playground: calling `deleteProductFromOrder`/`updateProductAmount` on seed order `order-1` (`status: 'finished'`) returns a GraphQL error, not a mutated order — **not performed** (no running browser/Playground session in this environment); equivalent coverage exists as an automated test (`orderService.test.ts`, "manual-parity check" case) that calls both guarded methods against seed `order-1` directly and asserts the same throw.

---

## Iteration 5.2 — Split `OrderListItem` (cart-editing) from new `OrderHistoryItem` (read-only)

Depends on: 5.1 (the UI split without the backend guard would be security-theater only)
Estimate: 2.5h

Files:
- `frontend/src/components/OrderListItem.tsx` (modify — trim to `created`-only)
- `frontend/src/components/OrderHistoryItem.tsx` (create)
- `frontend/src/components/OrderList.tsx` (modify — branch render by status)

Changes:
- `OrderListItem.tsx`: no functional change to its existing behavior (it already only renders the "Submit Order"/checkout button when `status === 'created'`), but its usage is now restricted — `OrderList.tsx` only ever mounts it for orders whose `status === 'created'`. Remove the now-unreachable `status` prop branching complexity if any was planned for non-`created` display (there wasn't, per current code — this is mostly a contract change enforced at the call site).
- `OrderHistoryItem.tsx` (new component):
  - Props (contract pinned now per plan-review N1, so Feature 6 doesn't have to guess or refactor on arrival): `{ order: { orderId: string; status: 'paid' | 'cancelled' | 'submited' | 'finished'; products: OrderItem[] }, onCancel?: (orderId: string) => void, cancelling?: boolean, cancelError?: string }` (delivery/payment fields added in 5.3). The three `onCancel`/`cancelling`/`cancelError` props are optional and unused by this iteration — they exist solely as the reserved extension point Feature 6 wires up (parent-owns-the-mutation shape: `OrderList.tsx` will own `useMutation(CANCEL_ORDER)` and pass these down, matching the existing `handleDelete`/`handleAmountChange` prop-drilling convention).
  - Renders: product list (image, title, description, price, amount) with **no** quantity +/− controls and **no** delete button — pure read-only display, reusing the same `Card`/`Avatar` visual style as `OrderListItem` for consistency
  - Renders a status badge (e.g. "Paid", "Cancelled") — full detail block (address/method/payment) deferred to iteration 5.3
  - No "Cancel Order" button in this iteration (that's Feature 6's addition on top of this component, per §0) — the button itself, gated on `status === 'paid' && onCancel`, is added by Feature 6's iteration 6.4, not here
- `OrderList.tsx`: change the per-order render from unconditionally mapping `OrderListItem` to branching per order: `order.status === 'created' ? <OrderListItem .../> : <OrderHistoryItem order={order} />`. Remove the `handleSubmitOrder`/`SUBMIT_ORDER` wiring only if not still needed by Feature 1's "Proceed to Checkout" replacement — coordinate, don't delete blindly (see Shared Files table).

Done criteria:
- [x] An order with `status: 'created'` renders via `OrderListItem` with working quantity +/− and delete controls (unchanged from today)
- [x] An order with `status: 'paid'`, `'cancelled'`, `'submited'`, or `'finished'` renders via `OrderHistoryItem` with **no** quantity controls and **no** delete button visible in the DOM (not just visually hidden — not rendered)
- [x] Component test: `OrderHistoryItem.test.tsx` (new) asserts absence of `+`/`-`/trash-icon buttons for a `paid` order fixture
- [x] Component test: `OrderList.test.tsx` (new or extended) asserts a mixed list (one `created`, one `paid` order) renders exactly one `OrderListItem` and one `OrderHistoryItem`
- [ ] Manual check: seed order `order-1` (`finished`) no longer shows editable quantity/delete controls on `/order` page — **not performed** (no running browser session); `OrderHistoryItem.test.tsx`'s legacy-order-1-style fixture (missing delivery/payment fields, `status: 'finished'`) is the automated equivalent.

---

## Iteration 5.3 — Order detail block (delivery, method, payment status) + most-recent-first sort

Depends on: 5.2
Estimate: 2h

Files:
- `frontend/src/graphql/queries.ts` (modify — extend `GET_ORDERS`/`GET_ORDER` selections)
- `frontend/src/components/OrderHistoryItem.tsx` (modify — render detail block)
- `frontend/src/components/OrderList.tsx` (modify — client-side sort)

Changes:
- `GET_ORDERS`/`GET_ORDER`: add field selections `deliveryAddress { recipientName phone country city street building apartment postalCode } deliveryMethod { type fee estimatedDays } payment { status cardLast4 cardholderName failureReason createdAt } total createAt` (matches tech-design §3.2 `Order` type; `createAt` needed for the sort below). If any of these fields don't yet exist on the deployed schema (Features 2–4 not yet merged, see §0 baseline assumption), Apollo returns `null`/`undefined` for the missing sub-object — render defensively (optional chaining), no crash.
- `OrderHistoryItem.tsx`: render a detail block below the product list — delivery address (formatted single block), delivery method label + fee, payment status badge ("Paid" / mapped from `payment.status`), and total. All fields optional-chained; render "—" or omit the row if a field is `null`/`undefined` (covers legacy `order-1`/`order-2` seed orders with no delivery/payment data).
- `OrderList.tsx`: sort the `orders` array by `createAt` descending before rendering (`[...orders].sort((a, b) => b.createAt - a.createAt)`), since `IOrderRepository.findByUserId` returns insertion order with no sort guarantee (tech-design §4.5 edge case).

> Why sort client-side, not server-side: tech-design §4.5 explicitly calls this out as a client-side fix since the repository layer's `findByUserId` contract isn't being changed as part of this epic.

Done criteria:
- [x] AC-503-1: an order card for a `paid` order shows items, delivery address, delivery method + fee, payment status ("Paid"), and total
- [x] AC-503-3: given 2+ orders with different `createAt`, they render most-recent-first
- [x] A seed order missing `deliveryAddress`/`deliveryMethod`/`payment` (e.g. legacy `order-1`) renders without crashing — detail rows for missing fields are omitted or show a placeholder, not `undefined`/`[object Object]`
- [x] Component test: `OrderList.test.tsx` extended — three order fixtures with different `createAt` values render in descending order
- [x] Component test: `OrderHistoryItem.test.tsx` extended — fixture with full delivery/payment data renders all five required fields; fixture with `deliveryAddress: null` renders without throwing

---

## Iteration 5.4 — `CheckoutConfirmationPage`

Depends on: 5.3 (reuses the same detail-rendering approach), Feature 4's `pay` mutation for end-to-end testing (stubbed with a fixture order otherwise)
Estimate: 2.5h

Files:
- `frontend/src/pages/checkout/CheckoutConfirmationPage.tsx` (modify — replaces Feature 4 iteration 3.4's stub if already landed; create if not)
- `frontend/src/App.tsx` (modify — add `/checkout/confirmation/:orderId` route if not already scaffolded by Features 1–4's nested `<Switch>`, per tech-design §6.1)
- `frontend/src/graphql/queries.ts` (modify, if not already covered by 5.3 — ensure `GET_ORDER(orderId)` includes the same field set as `GET_ORDERS`)

Changes:
- `CheckoutConfirmationPage`: route param `orderId`, fires `GET_ORDER(orderId)`, renders order id, purchased items, delivery address, delivery method, and total paid (AC-501-1). Loading/error states follow the existing app convention (spinner, error banner — same pattern as `OrderList`).
- A "My Orders" link/button navigating to `/order` (AC-501-2) — reuses `useHistory().push('/order')`, same pattern as `CurrentOrder.tsx`'s existing click handler.
- Guard: if the fetched order's `status !== 'paid'` (e.g. user manually edits the URL to an order that never paid), render a message directing back to `/order` rather than showing a false "confirmation" — defensive, not a formal AC, but prevents a misleading screen.

Done criteria:
- [x] AC-501-1: navigating to `/checkout/confirmation/:orderId` for a `paid` order shows order id, item list, delivery address, delivery method, and total
- [x] AC-501-2: clicking "My Orders" navigates to `/order` and the same order appears in the list (validated together with 5.3's rendering)
- [x] Component test: `CheckoutConfirmationPage.test.tsx` (new) — mocked Apollo `GET_ORDER` response renders all four required data points
- [x] Component test: same file — order fixture with `status: 'created'` (not yet paid) renders the redirect-guard message instead of confirmation content
- [ ] Manual check (once Feature 4 is available): completing mock payment with any non-decline card lands on this page with correct data — **not performed** (no running browser session in this environment); covered end-to-end at the unit/component level by `PaymentService.pay`'s tests plus `CheckoutConfirmationPage.test.tsx`'s mocked-response tests.

---

## Iteration 5.5 — Fix `CurrentOrder` header stub (drop `localStorage`, use `currentCart`)

Depends on: none technically (only needs `currentCart` query to exist, per Feature 1), but sequenced after 5.4 in this plan for delivery cohesion
Estimate: 1.5h

Files:
- `frontend/src/components/CurrentOrder.tsx` (modify — full rewrite per tech-design §6.4)
- `frontend/src/graphql/queries.ts` (modify — add `GET_CURRENT_CART` defensively if Feature 1 hasn't landed it yet; idempotent no-op otherwise)

Changes:
- Remove all `localStorage.getItem('currentItems')`/`setItem` code and the `useState`/`useEffect` stub entirely.
- Add `const { data } = useQuery(GET_CURRENT_CART)`.
- `itemCount = data?.currentCart?.products?.reduce((sum, item) => sum + item.amount, 0) ?? 0`.
- Badge renders only when `itemCount > 0` (unchanged visual behavior, real data source).
- No new mutation, no explicit "clear cart" call — clearing is a side effect of the order leaving `created` status after `pay` succeeds (tech-design §6.4): `currentCart` naturally returns `null` once the order is `paid`, so the badge disappears with zero new backend work.

Done criteria:
- [x] AC-502-2: after a successful payment (order transitions to `paid`), the header badge shows no count (or is hidden) on next render/poll — verified via component test with two sequential mock responses (`currentCart` returning an order, then `null`)
- [x] No `localStorage` read/write remains anywhere in `CurrentOrder.tsx` (`grep -r "localStorage" frontend/src/components/CurrentOrder.tsx` returns nothing) — verified both by `grep` and by an automated regression test that reads the file's source and asserts it
- [x] Component test: `CurrentOrder.test.tsx` (new) — mocked `GET_CURRENT_CART` returning `{ currentCart: { products: [{amount: 3}, {amount: 2}] } }` renders badge "5"; returning `{ currentCart: null }` renders no badge
- [x] Clicking the cart icon still navigates to `/order` (unchanged existing behavior, regression-checked)

---

## Iteration 5.6 — Edge cases & full AC closure pass

Depends on: 5.1–5.5
Estimate: 2h

Files:
- `frontend/src/components/OrderList.tsx` (modify — visual distinction for a `created` cart coexisting with paid orders)
- `frontend/src/components/OrderHistoryItem.tsx` (modify — minor label/badge tweaks if needed from manual pass)
- No backend changes expected in this iteration

Changes:
- AC-503-2: when a `created`-status cart (rendered via `OrderListItem`) and one or more `paid`/`cancelled` orders (via `OrderHistoryItem`) are both present in the same list, ensure the `created` entry is visually labeled "Cart" (not a payment-status badge) and is clearly distinguished from the history entries — mostly already true from the 5.2 component split, this iteration is the explicit verification + any label polish tech-design §4.5's edge case calls for.
- AC-502-3: verify the empty-cart state (post-purchase, no `created` order left) renders the same empty-state message as US-102's AC-102-2 rather than erroring — this is primarily Feature 1's `OrderPage`/`currentCart`-driven empty state, but this iteration is where Feature 5's "cart cleared" claim gets its final cross-check against that shared message.
- Full manual walkthrough of US-501/502/503 acceptance criteria against a running instance (with Feature 4 available) as the closing task of this feature.

Done criteria:
- [x] AC-503-2: manual check — a fixture list containing one `created` order and one `paid` order shows a "Cart" label on the former and a "Paid" status badge on the latter, no visual ambiguity — covered by `OrderList.test.tsx`'s mixed-list test (automated equivalent; no live browser session available in this environment)
- [x] AC-502-1/502-3: after payment success (order leaves `created`), `OrderList`'s pre-existing zero-orders empty state ("No orders found") continues to render (no code change needed — verified by reading `OrderList.tsx`'s existing `orders.length === 0` branch, unchanged by this feature); the `/checkout/address` empty-cart message (AC-102-2/3) is Feature 1's responsibility and out of this feature's file scope, cross-checked here per the plan's instruction, not re-implemented
- [ ] All AC-501-*, AC-502-*, AC-503-* checkboxes in `05-order-confirmation-and-history.md` are manually verified and can be checked off — left unchecked in that file: this implementer verified them via automated tests, not a live manual walkthrough (no running app/browser in this environment); recommend a human/QA pass before shipping
- [x] Full regression pass: existing cart editing (`created` orders) still works unchanged after all of 5.1–5.5 — full backend (50/50) and frontend (62/62) suites pass, `tsc --noEmit` clean in both packages
- [x] `docs/decisions.md` updated with the backend-guard rationale, the `OrderService`/`PaymentService` setter-injection wiring, and the "Cart" vs. status-badge labeling call

---

## Summary Estimate

| Iteration | Estimate |
|---|---|
| 5.1 | 1h |
| 5.2 | 2.5h |
| 5.3 | 2h |
| 5.4 | 2.5h |
| 5.5 | 1.5h |
| 5.6 | 2h |
| **Total** | **11.5h** |
