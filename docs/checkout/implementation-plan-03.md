# Implementation Plan — Feature 3: Order Review Step

**Parent requirements**: [`03-order-review.md`](03-order-review.md) (US-301, AC-301-1/2/3)
**Tech design contract**: [`tech-design.md`](tech-design.md) §2.1, §2.3, §3.2, §4.3 (revised — server-computed total, not client math)
**Status**: DRAFT — ready for plan review (Phase 5)

This plan covers Feature 3 only. It does not re-plan the shared data model, GraphQL contract, or other features — see `00-overview.md` §3 for read order and the "Shared/Cross-Feature Files" section below for coordination with the other five feature plans being written concurrently against the same `tech-design.md`.

---

## Position in the Overall Dependency Chain

```
Feature 1 (auth-gated checkout, PrivateRoute, CheckoutProvider, currentCart query)
   → Feature 2 (delivery address + method → persisted on Order via setDeliveryDetails)
      → Feature 3 (THIS PLAN — review screen, reads the persisted address/method + a NEW
                    server-computed total, no mutation)
         → Feature 4 (payment — needs the confirmed total to charge the correct amount)
            → Feature 5 (confirmation/history)
               → Feature 6 (cancellation)
```

**Hard dependency on Feature 2**: `CheckoutReviewPage` cannot render anything meaningful until an order carries `deliveryAddress`/`deliveryMethod` — those are written by Feature 2's `submitDeliveryDetails` mutation. Feature 3's iterations assume Feature 2's backend fields (`OrderRecord.deliveryAddress`, `OrderRecord.deliveryMethod`, the corresponding `DeliveryAddress`/`DeliveryMethodSnapshot` types in `backend/src/types/entities.ts`) and frontend scaffolding (`PrivateRoute`, `CheckoutProvider`/`CheckoutContext`, the nested `/checkout/*` route tree in `frontend/src/App.tsx`, `Query.currentCart` + `GET_CURRENT_CART`) already exist. If Feature 3 lands in a branch/PR before Feature 2 merges, Iteration 2.2 below is blocked on those artifacts — call this out explicitly to whoever schedules merge order.

**What Feature 3 hands to Feature 4**: the new `calculateOrderTotal` helper and the `Order.total` GraphQL field (Phase 1 below) are **not** Feature-3-only — Feature 4's `PaymentService.pay` calls the exact same helper server-side to compute the charge amount (tech design §5, step 3: `amount = calculateOrderTotal(...)`), and Feature 5's confirmation/history screens display the same `total` field. Phase 1 of this plan should be scheduled early and treated as a shared-infrastructure delivery, not something Feature 3 "owns" exclusively going forward.

---

## Shared/Cross-Feature Files

| File | Feature 3 touches it for... | Also touched by... | Coordination note |
|---|---|---|---|
| `backend/src/services/orderService.ts` | Adding `calculateOrderTotal`, extending `transformToDTO` to compute `total` | Feature 2 (`setDeliveryDetails`), Feature 6 (`cancelOrder`, guard on `deleteProductFromOrder`/`updateProductAmount`) | Additive method + one new field in the returned DTO object; low collision risk, but merge order matters if another feature's branch also edits `transformToDTO` in parallel — rebase carefully, do not let two branches both hand-edit the same return-object literal without diffing |
| `backend/src/types/entities.ts` | Adding `total: number` to `OrderDTO` | Feature 2 (`deliveryAddress`/`deliveryMethod` fields), Feature 4 (`paymentId`/`paidAt`, `PaymentRecord`/`PaymentSummaryDTO`), Feature 6 (`cancelled` status, `cancelledAt`) | This is the single most shared file in the epic. Confirm Feature 2's `deliveryAddress?`/`deliveryMethod?: DeliveryMethodSnapshot` fields already exist on `OrderRecord`/`OrderDTO` before starting Iteration 1.1 — `calculateOrderTotal`'s call site needs `order.deliveryMethod?.fee ?? 0` |
| `backend/src/graphql/schema.ts` | Adding `total: Float!` to `type Order` | Feature 1 (`currentCart` query), Feature 2 (`deliveryAddress`/`deliveryMethod` fields, `deliveryMethods` query, `submitDeliveryDetails` mutation), Feature 4 (`payment` field, `pay` mutation), Feature 6 (`cancelOrder` mutation, `cancelled` enum value) | Single-file schema — expect merge conflicts across all six feature branches touching this file in the same region (`type Order { ... }`). Keep the diff to exactly one added line if possible |
| `backend/src/graphql/resolvers.ts` | **Not modified** by Feature 3 — `total` resolves automatically off the DTO object returned by existing `order`/`orders`/`currentCart` resolvers, no per-field resolver needed | Features 1, 2, 4, 6 all add new resolvers here | Confirms Feature 3 has the smallest resolver footprint of the six — flag this so plan-reviewer doesn't expect a resolver diff here |
| `frontend/src/graphql/queries.ts` | Adding `total` to whichever query selects `currentCart` fields (`GET_CURRENT_CART`, owned/created by Feature 1, extended by Feature 2) | Features 1 (create), 2 (extend), 5 (extend `GET_ORDERS`/`GET_ORDER`) | Additive field in an existing selection set; verify Feature 2's extension (adding `deliveryAddress { ... } deliveryMethod { ... }`) has already landed before adding `total` alongside it |
| `frontend/src/App.tsx` | Registering the `/checkout/review` route's target component (`CheckoutReviewPage`) inside the existing nested `<Switch>` (tech design §6.1) | Features 1 (creates the route tree/`PrivateRoute`/`CheckoutProvider` wrapper), 2, 4, 5 add their own route's component | The route path `/checkout/review` itself is already declared in tech design §6.1's route tree (owned by Feature 1's scaffolding); Feature 3 only swaps in the real component for what may start as a placeholder |

---

## Phase 1 — Server-Side Order Total (Shared Contract)

**After this phase**: the backend can compute an authoritative total (subtotal with promo discount applied, plus delivery fee) for any order and expose it as `OrderDTO.total` / GraphQL `Order.total`, without any client-side arithmetic. Existing `calculateOrderSum`/`orderSum` query behavior is unchanged. The app still compiles, runs, and all existing tests/manual flows (cart view, promo query) work exactly as before — this phase is purely additive.

> Why this is its own phase, not folded into Phase 2: Feature 4 (payment) and Feature 5 (confirmation/history) both need `calculateOrderTotal`/`Order.total` to exist before their own iterations can be written against it (tech design §5 step 3, §4.5). Landing it as an isolated, independently-mergeable phase lets those other feature branches rebase on it early instead of waiting for Feature 3's frontend work.

### Iteration 1.1 — `calculateOrderTotal` helper + `OrderDTO.total` wiring

Depends on: Feature 2's `deliveryAddress`/`deliveryMethod` fields already present on `OrderRecord`/`OrderDTO` in `backend/src/types/entities.ts` (external dependency, not part of this plan)
Estimate: 1.5h

Files:
- `backend/src/services/orderService.ts` (modify)
- `backend/src/types/entities.ts` (modify)
- `backend/src/services/__tests__/orderService.test.ts` (create, or extend if a test file already exists for this service by the time this iteration runs)

Changes:
- `OrderService.calculateOrderTotal(products: Array<{id: string, amount: number, price: number}>, promoId: string | undefined, deliveryFee: number): number` — new method, `return this.calculateOrderSum(products, promoId) + deliveryFee`. Does not modify `calculateOrderSum` itself (tech design §4.3: "extends", i.e. wraps, not rewrites).
- `OrderService.transformToDTO(order: OrderRecord): OrderDTO` (private, existing method at line ~153) — extend the returned object literal with:
  ```ts
  total: this.calculateOrderTotal(order.products, order.promo?.id, order.deliveryMethod?.fee ?? 0)
  ```
  > Why `?? 0`: an order that hasn't reached Feature 2's delivery step yet (e.g. a bare `created` cart, or legacy seed orders `order-1`/`order-2`) has no `deliveryMethod`; per tech design §2.1 the total in that case is subtotal-only (fee is 0), not an error.
- `backend/src/types/entities.ts` — add `total: number;` to the `OrderDTO` interface (§2.1). No change to `OrderRecord` (total is never stored, only computed).

Done criteria:
- [x] `calculateOrderTotal([], undefined, 0)` returns `0`
- [x] `calculateOrderTotal(products, undefined, 5.99)` returns `subtotal + 5.99` for a products array with a known subtotal
- [x] `calculateOrderTotal(products, validNonExpiredPromoId, 5.99)` returns `(subtotal - discount) + 5.99`, matching the discount math already covered by existing `calculateOrderSum` tests
- [x] `calculateOrderTotal(products, expiredPromoId, 5.99)` returns `subtotal + 5.99` (expired promo ignored, same as `calculateOrderSum`'s existing behavior)
- [x] Unit test: `transformToDTO` (exercised indirectly via `getOrderById`/`getOrdersByUserId`) returns `total` equal to `subtotal` (no discount, no fee) for a `created` order with no `deliveryMethod` set
- [x] Unit test: `transformToDTO` returns `total` equal to `subtotal + deliveryMethod.fee` for an order carrying a `deliveryMethod` snapshot
- [x] `npm run build` (or equivalent TS compile check) passes with no type errors from the new `OrderDTO.total` field
- [x] No existing test (promo, `calculateOrderSum`, order list/detail) regresses

### Iteration 1.2 — Expose `total` on the GraphQL `Order` type

Depends on: 1.1
Estimate: 0.5h

Files:
- `backend/src/graphql/schema.ts` (modify)

Changes:
- Add `total: Float!` as a new field on `type Order { ... }` (tech design §3.2). No resolver changes — Apollo's default resolver reads `total` directly off the `OrderDTO` object already returned by `orders`/`order` (and, once Feature 1 lands, `currentCart`).

Done criteria:
- [x] GraphQL schema compiles / server boots without SDL errors
- [x] Manual/integration check: a GraphQL Playground query for `order(orderId: "...")  { total }` against a seeded order returns a numeric value equal to `subtotal (+ promo discount) (+ delivery fee)` computed by hand for that seed data
- [x] Existing `orders`/`order` queries still return all pre-existing fields unchanged (no regression in `orderId`, `status`, `products`, `promo`)
- [x] `Order.total` is non-null (`Float!`) for every order in current seed data, including orders with no `deliveryMethod` (fee defaults to 0, never `null`/`undefined`)

---

## Phase 2 — Order Review Screen (Frontend)

**After this phase**: an authenticated user who has completed Feature 2's address/delivery step lands on `/checkout/review`, sees their line items, delivery address, delivery method, and the server-computed total (AC-301-1/2), and clicking "Confirm and Pay" navigates to `/checkout/payment` with no mutation fired (AC-301-3, review is read-only). Deep-linking to `/checkout/review` without a completed delivery step redirects back to `/checkout/address` instead of rendering a broken summary.

### Iteration 2.1 — `OrderReviewSummary` presentational component

Depends on: 1.2 (needs `total` field available on the `Order` type to type/prop the component against; can be developed against a mocked prop shape in parallel if 1.2 isn't merged yet)
Estimate: 1.5h

Files:
- `frontend/src/components/checkout/OrderReviewSummary.tsx` (create)
- `frontend/src/components/checkout/__tests__/OrderReviewSummary.test.tsx` (create)

Changes:
- New component, props:
  ```ts
  interface OrderReviewSummaryProps {
    products: Array<{ product: { id: string; title: string; image: string }; amount: number; price: number }>;
    deliveryAddress: DeliveryAddress;
    deliveryMethod: { type: 'regular' | 'extra'; fee: number; estimatedDays: string };
    total: number;
  }
  const OrderReviewSummary: React.FC<OrderReviewSummaryProps> = ({ products, deliveryAddress, deliveryMethod, total }) => { ... }
  ```
- Renders: line items (title, amount, price, image), a formatted address block, delivery method label + fee + estimated window, and the total.
- Currency formatting: reuses the exact convention from `frontend/src/components/OrderSum.tsx` (`` `$${value.toFixed(2)}` ``) rather than importing `OrderSum` itself (per tech design §4.3, `OrderSum` is tied to the `GET_ORDER_SUM` query, which has no concept of delivery fees). Pulled into a tiny shared helper:
  - `frontend/src/utils/formatCurrency.ts` (create) — `export const formatCurrency = (value: number): string => \`$${value.toFixed(2)}\`` — used here and flagged as a convenience other features (4's payment amount display, 5's confirmation/history) may also want, so it isn't reimplemented three more times.
- Renders total using `formatCurrency(total)`, not `subtotal + deliveryMethod.fee` computed in the component — the prop **is** the server value, passed straight through.

Done criteria:
- [x] Test: renders all line items with correct title/amount/price
- [x] Test: renders delivery address fields (recipient name, full address line, phone)
- [x] Test: renders delivery method label, fee, and estimated days matching AC-202-1's display format
- [x] Test: renders `total` prop formatted as `$X.XX` via `formatCurrency`, with **no** arithmetic performed inside the component (assert by passing a `total` prop that deliberately does *not* equal `subtotal + fee` and confirming the displayed value is the prop, not a recomputation — this guards against a regression back to client-side math)
- [x] Component has no GraphQL/Apollo dependency — pure presentational, testable with plain props

### Iteration 2.2 — `CheckoutReviewPage`: data fetching, guard, and navigation

Depends on: 2.1; external dependency on Feature 1's `Query.currentCart`/`GET_CURRENT_CART` and Feature 2's `CheckoutProvider`/route tree already existing in `frontend/src/App.tsx`
Estimate: 2h

Files:
- `frontend/src/pages/checkout/CheckoutReviewPage.tsx` (create)
- `frontend/src/graphql/queries.ts` (modify — add `total` to the `currentCart`/`GET_CURRENT_CART` selection set, alongside the `deliveryAddress`/`deliveryMethod` fields assumed already added by Feature 2)
- `frontend/src/App.tsx` (modify — wire `CheckoutReviewPage` as the component for the existing `/checkout/review` route entry in the nested `<Switch>`, replacing any placeholder)
- `frontend/src/pages/checkout/__tests__/CheckoutReviewPage.test.tsx` (create)

Changes:
- `CheckoutReviewPage`: `useQuery(GET_CURRENT_CART)` on mount.
  - `loading` → spinner (reuse existing loading UI convention, e.g. `Loader2` per `OrderSum.tsx`).
  - `error` → error banner with a retry affordance (per overview NFR on the 1500ms delay / 1-in-5 chaos 500 — this endpoint is not exempt from `errorTestMiddleware`).
  - `data.currentCart === null` → redirect to `/checkout/address` (no cart at all — mirrors Feature 1's empty-cart handling, AC-102-2/3).
  - `data.currentCart` present but `!deliveryAddress || !deliveryMethod` → redirect to `/checkout/address` (tech design §4.3 edge case: deep-link or a chaos-500-interrupted Feature 2 submission left the order without delivery info — do not render a broken summary).
  - Otherwise → render `<OrderReviewSummary products={...} deliveryAddress={...} deliveryMethod={...} total={currentCart.total} />` plus a "Confirm and Pay" button.
  - "Confirm and Pay" `onClick` → `history.push('/checkout/payment')`. **No mutation is fired** — per AC-301-3 and tech design §4.3 step 3, all state was already committed to the order by Feature 2; this is purely a navigation action.

Done criteria:
- [x] Test: renders `OrderReviewSummary` with `currentCart`'s products/address/method/total when all are present (AC-301-1)
- [x] Test: displayed total equals the value returned by the `currentCart.total` GraphQL field verbatim, not a client-computed `subtotal + fee` (AC-301-2 — assert against a mocked Apollo response where `total` is deliberately set to a value that would differ from a naive client recompute, to prove there's no shadow calculation)
- [x] Test: clicking "Confirm and Pay" calls `history.push('/checkout/payment')` and does **not** invoke any mutation (assert no `useMutation` call/mock was triggered) — AC-301-3
- [x] Test: `currentCart: null` → redirects to `/checkout/address`
- [x] Test: `currentCart` present with `deliveryAddress: null` or `deliveryMethod: null` → redirects to `/checkout/address` (does not render `OrderReviewSummary`)
- [x] Test: GraphQL error (simulated network/chaos error) renders an error banner with retry, not a crash
- [ ] Manual verification: navigating the real flow address → review after Feature 2's step shows correct line items, address, method, and a total matching the backend calculation by hand for a seeded promo + delivery fee combination (NOT performed — no interactive browser available in this environment; covered instead by automated integration tests against mocked Apollo responses plus a backend unit test proving `total = subtotal + deliveryMethod.fee` after `setDeliveryDetails`)
- [ ] Manual verification: refreshing the browser directly on `/checkout/review` for an order that has completed Feature 2's step re-renders the same summary (state is server-sourced, not lost on refresh) (NOT performed manually — the page is server-sourced by design (`useQuery(GET_CURRENT_CART)` on every mount, no local cache dependency), so this should hold, but a real browser refresh was not exercised)
- [ ] **AC-202-3/4/5 (owned by this feature, per plan-02's explicit deferral)**: the total rendered here reflects whichever delivery method (Regular/Extra) was selected in Feature 2 — verify by completing the delivery step twice with different method selections and confirming the review total differs by exactly the fee delta between the two methods (NOT manually verified end-to-end; backend unit test confirms `total` includes `deliveryMethod.fee` for the `extra` method snapshot)

**CRITICAL — plan-review B1 fix**: `PaymentService.pay` (Feature 4, `implementation-plan-04.md`) must call this iteration's `calculateOrderTotal` as `calculateOrderTotal(order.products, order.promo?.id, order.deliveryMethod?.fee ?? 0)` — passing the promo **id string**, matching this iteration's real signature (line ~59), NOT the full `PromoEntity` object. Plan-04 originally had this wrong (copied from tech-design §5's stale pseudocode); it must be corrected before Feature 4 is implemented, or a user with an active promo will see a discounted review total but be charged the full pre-discount amount.

### Iteration 2.3 — Wire route + close out AC-301 traceability

Depends on: 2.2
Estimate: 1h

Files:
- `frontend/src/App.tsx` (modify — confirm final route wiring, no placeholder left)
- `docs/checkout/03-order-review.md` (modify — check off ACs as verified, per project convention of tracking AC checkboxes)

Changes:
- No new production code; this iteration is a verification/closeout pass once Features 1 and 2's scaffolding has actually merged (if it hadn't yet at 2.2 time, this is where the integration is confirmed against the real thing instead of a stub/mock).
- Confirm `CheckoutProvider`'s state (tech design §6.2, `CheckoutState.step`) is set to `'review'` on entering this page if any other feature's code reads that field (defensive check only — Feature 3 itself doesn't require `CheckoutContext` for anything since all data is server-sourced via `currentCart`).

Done criteria:
- [ ] End-to-end manual run: log in → land on cart → complete Feature 2's address/method form → land on `/checkout/review` → see correct summary and total → click "Confirm and Pay" → land on `/checkout/payment` (or its current placeholder if Feature 4 hasn't merged yet) (NOT performed — no interactive browser in this environment; equivalent coverage via automated component/integration tests plus a manual backend server boot check confirming the GraphQL schema/resolvers are valid)
- [x] AC-301-1, AC-301-2, AC-301-3 all checked off in `03-order-review.md`
- [ ] No console errors/warnings introduced by the new page/component in a manual browser check (NOT performed — no browser available; `npx tsc --noEmit` is clean and no lint/test warnings were observed)
- [x] `main` builds and all tests (backend + frontend) pass after this iteration

---

## Summary Table

| Iteration | Depends on | Estimate | Primary files |
|---|---|---|---|
| 1.1 | Feature 2's entity fields (external) | 1.5h | `orderService.ts`, `entities.ts` |
| 1.2 | 1.1 | 0.5h | `schema.ts` |
| 2.1 | 1.2 (loosely) | 1.5h | `OrderReviewSummary.tsx`, `formatCurrency.ts` |
| 2.2 | 2.1, Features 1/2 scaffolding (external) | 2h | `CheckoutReviewPage.tsx`, `queries.ts`, `App.tsx` |
| 2.3 | 2.2 | 1h | `App.tsx`, `03-order-review.md` |

**Total estimate**: ~6.5h across 5 iterations, 2 phases.

---

## Notes for Plan-Reviewer

1. **Phase 1 has no frontend dependency and can be scheduled/merged independent of Feature 2's frontend work** — only its *backend* entity fields (`deliveryAddress`/`deliveryMethod` on `OrderRecord`) are a prerequisite. Recommend landing Phase 1 as early as possible since Features 4 and 5 both consume `calculateOrderTotal`/`Order.total`.
2. **Iteration 2.2 is the one true blocking point on other features' work** — it cannot be manually verified end-to-end until Feature 1 (auth gate, `currentCart`) and Feature 2 (delivery form, persisted `deliveryAddress`/`deliveryMethod`) exist. Unit tests in 2.1/2.2 are written against mocked Apollo responses so they don't block on that merge order, but the manual verification checkboxes in 2.2/2.3 do.
3. **No backend mutation is added by this feature** — this is deliberate per AC-301-3 and tech design §4.3 ("no mutation fires here; review is read-only"). If a future reviewer expects a `confirmReview` mutation, that would be a scope change requiring a requirements update, not a planning gap.
4. Per tech-design §7 risk 7, `submitDeliveryDetails`/`cancelOrder` need chaos-500-resilient error handling; Iteration 2.2 gives `CheckoutReviewPage`'s own `currentCart` query the same treatment for consistency, even though the review step's only network calls are queries, not the chaos-prone mutations themselves.
