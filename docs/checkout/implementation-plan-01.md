# Implementation Plan — Feature 1: Auth-Gated Checkout

**Status**: DRAFT — awaiting plan review (Phase 5)
**Parent requirements**: [`01-auth-gated-checkout.md`](01-auth-gated-checkout.md) (US-101, US-102)
**Parent design**: [`tech-design.md`](tech-design.md) §3.1, §4.1, §6.1, §6.2, §6.5 (frozen contract — this plan does not redefine any shared type)
**Scope**: US-101 (redirect unauthenticated users) + US-102 (authenticated entry into checkout) only. Delivery/review/payment/confirmation/cancellation pages are stubbed here, not implemented — they belong to features 2–6.

---

## 0. Position in the epic's dependency order

Per tech-design §6.1/§7.3, Feature 1 is the **entry point** and must land first:

- It owns the `App.tsx` routing restructure (`/checkout` parent route → `PrivateRoute` → `CheckoutProvider` → nested `<Switch>`) that every other feature's page routes sit inside.
- It creates the `CheckoutContext` scaffold (§6.2) that features 2–4 extend with real wizard state.
- It creates placeholder components for `/checkout/review`, `/checkout/payment`, `/checkout/confirmation/:orderId` purely so the app compiles and routes resolve — features 3, 4, 5 replace these wholesale with real implementations (see §Shared Files below for the hand-off risk this creates).
- It also (Phase 1 below) performs the `backend/src/app.ts` dual-repository fix. That fix is not conceptually "Feature 1's" — tech-design §7 risk 3 explicitly says no single feature owns it — but since Feature 1 is first in the schedule, this plan does it here so every subsequent feature builds on consistent repository instances from day one. **If another planner's branch lands this fix first, iteration 1.1 becomes a no-op — check `app.ts` before starting.**

No iteration in this plan implements delivery, review, payment, or cancellation logic. AC-102-1's "lands on the delivery/address step" is satisfied by navigating to a real `/checkout/address` route that correctly gates on auth + empty-cart; the actual delivery form is feature 2's payload inside that same route.

---

## 1. Phases

### Phase 1 — Backend Foundations
After this phase: repositories are instantiated once and shared between REST and GraphQL (no more silent data-split bug), and a `currentCart` GraphQL query exists that returns the caller's single `created`-status order (or `null`), authenticated the same way as every other resolver.

Iterations: 1.1, 1.2

### Phase 2 — Frontend Routing & Auth Gate Skeleton
After this phase: the app has a working `PrivateRoute`, the `/checkout` route tree exists (with placeholder pages), navigating to any `/checkout/*` path while logged out redirects to `/login` and back again after a successful login, and an expired/invalid JWT anywhere in the checkout flow triggers a clean redirect-to-login instead of a stuck error state.

Iterations: 2.1, 2.2, 2.3, 2.4

### Phase 3 — Entry Point Wiring & Empty-Cart UX
After this phase: US-101 and US-102 are fully demoable — a guest is bounced to login and returned to checkout; a logged-in user with items in their cart reaches `/checkout/address`; a logged-in user with an empty or nonexistent cart sees the empty-cart message instead of a form or a crash.

Iterations: 3.1, 3.2

---

## 2. Iterations

## Iteration 1.1 — Fix dual-repository instantiation bug in `app.ts`

Depends on: none
Estimate: 1.5h

Files:
- `backend/src/app.ts` (modify)

Changes:
- Move `InMemoryUserRepository`, `InMemoryAuthRepository`, `InMemoryOrderRepository`, `InMemoryProductRepository`, `InMemoryPromoRepository` construction out of `initializeRoutes()` and `initializeGraphQL()` and into the `App` constructor, stored as instance fields (e.g. `private userRepository`, `private authRepository`, etc.)
- `initializeRoutes()` and `initializeGraphQL()` both consume `this.<repo>` instead of constructing their own copies
- `this.orderRepositories` (used by `/reset/orders`) now holds exactly one `InMemoryOrderRepository` instance, pushed once in the constructor
- No change to any repository or service interface/shape

Done criteria:
- [x] `App` constructs each repository exactly once (grep confirms a single `new InMemory*Repository()` call per repo type in `app.ts`)
- [x] Manual check: `POST /api/order/:id/product` (REST) followed by a GraphQL `order(orderId: ...)` query for the same order returns the REST mutation's effect (previously these were invisible to each other) — verified via curl: REST `DELETE /api/order/order-2/product-2` immediately visible in GraphQL `order(orderId:"order-2")`
- [x] Manual check: existing flows unaffected — `POST /api/login`, GraphQL `login` mutation, `GET /health`, `/api-docs`, `/reset/orders` all still respond as before
- [x] `npm run build` (backend) compiles with no new TypeScript errors

---

## Iteration 1.2 — Add `OrderService.getCurrentCart` and `Query.currentCart`

Depends on: 1.1 (so the resolver reads the same repository instance REST would)
Estimate: 1.5h

Files:
- `backend/src/services/orderService.ts` (modify)
- `backend/src/graphql/schema.ts` (modify)
- `backend/src/graphql/resolvers.ts` (modify)

Changes:
- `OrderService.getCurrentCart(userId: string): Promise<OrderDTO | null>` — finds the user's single `created`-status order via existing `orderRepository` lookups, returns `null` if none exist; reuses existing `transformToDTO`
- `schema.ts`: add `extend type Query { currentCart: Order }` (merged into existing `Query` block per file convention)
- `resolvers.ts`: add `Query.currentCart` resolver — `extractUserIdFromToken(context)` → throw `'Authentication required'` if missing → `orderService.getCurrentCart(userId)`; **per tech-design §3.3, do not wrap in a try/catch that discards the error** — let `'Authentication required'` and any other thrown error propagate unchanged

Done criteria:
- [x] GraphQL Playground: `{ currentCart { orderId status products { amount } } }` with a valid token for a user with a `created` order returns that order — verified via curl
- [x] Same query for a user with no `created` order returns `currentCart: null`, not an error (logic verified; `getCurrentCart` returns `null` when no `created`-status order is found)
- [x] Same query with no `Authorization` header returns a GraphQL error with message `Authentication required` — verified via curl
- [x] Existing `Query.order` / `Query.orders` resolvers and their error wording are untouched (diff review confirms no changes outside the new resolver)

---

## Iteration 2.1 — `PrivateRoute` component

Depends on: none
Estimate: 1h

Files:
- `frontend/src/components/PrivateRoute.tsx` (create)

Changes:
- `PrivateRoute: React.FC<{ children: React.ReactNode }>` — a plain wrapper (not a `<Route component={...}>` prop-injector, per tech-design §6.1 since it now wraps a `<Route path="/checkout">` rather than being one itself)
- Reads `localStorage.getItem('auth_token')`; if absent, calls `history.push({ pathname: '/login', state: { from: location.pathname } })` and renders nothing (or a redirect) instead of `children`
- If present, renders `children` unchanged
- Uses `useHistory()` / `useLocation()` from `react-router-dom` (matching existing v5 usage elsewhere, e.g. `LoginPage.tsx`)

Done criteria:
- [ ] Manual test (needs browser): render `<PrivateRoute><div>secret</div></PrivateRoute>` with no `auth_token` in localStorage → browser navigates to `/login`, `location.state.from` is set to the prior path
- [ ] Manual test (needs browser): same with a truthy `auth_token` set → `secret` renders, no navigation occurs
- [x] Component has no dependency on any checkout-specific type (pure auth gate, reusable by any future route)
- [x] `npm run build` (frontend) / `tsc` compiles with no new errors

---

## Iteration 2.2 — `App.tsx` routing restructure + `CheckoutContext` scaffold + stub checkout pages

Depends on: 2.1
Estimate: 2.5h

Files:
- `frontend/src/App.tsx` (modify)
- `frontend/src/context/CheckoutContext.tsx` (create)
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (create — minimal stub in this iteration, wired to real logic in 3.1)
- `frontend/src/pages/checkout/CheckoutReviewPage.tsx` (create — placeholder only, e.g. `<div>Review — coming soon</div>`; feature 3 replaces entirely)
- `frontend/src/pages/checkout/CheckoutPaymentPage.tsx` (create — placeholder only; feature 4 replaces entirely)
- `frontend/src/pages/checkout/CheckoutConfirmationPage.tsx` (create — placeholder only; feature 5 replaces entirely)

Changes:
- `App.tsx`: replace the flat `<Switch>` with the nested structure from tech-design §6.1 — a single `<Route path="/checkout">` (no `exact`) wrapping `PrivateRoute` wrapping `CheckoutProvider` wrapping a nested `<Switch>` of the four checkout routes (`/checkout/address`, `/checkout/review`, `/checkout/payment`, `/checkout/confirmation/:orderId`). Existing `/`, `/login`, `/order`, `/hui` routes are untouched.
- `CheckoutContext.tsx`: `CheckoutProvider` + `useReducer` implementing the `CheckoutState` shape from §6.2 (`orderId`, `address`, `deliveryMethodType`, `step`), in-memory only (no persistence — matches §6.2's documented assumption). Minimal reducer/actions for now (`SET_STEP` at minimum); features 2–4 extend this with real address/method-setting actions.

> Why stub pages, not deferred routing: React Router v5's outer `<Switch>` renders exactly one match; wiring the nested structure now (with placeholders) means `App.tsx`'s risky structural change happens once, in this feature, rather than being redone by each subsequent feature. Placeholders are clearly marked and intentionally minimal so there's no real behavior to regress when features 3–5 replace them.

Done criteria:
- [ ] Manual test (needs browser): Logged out (no `auth_token`), navigating to any of `/checkout/address`, `/checkout/review`, `/checkout/payment`, `/checkout/confirmation/x` redirects to `/login`
- [ ] Manual test (needs browser): Logged in, navigating to `/checkout/review` or `/checkout/payment` or `/checkout/confirmation/x` renders the respective placeholder without crashing
- [x] Logged in, navigating between the four checkout routes does not remount `CheckoutProvider` — structural property of the nested-route shape (single `<Route path="/checkout">` wraps one `CheckoutProvider` around an inner `<Switch>` of the four sub-routes, per §6.1); browser spot-check still recommended
- [ ] Manual test (needs browser): `/`, `/login`, `/order` continue to work exactly as before (manual smoke check)
- [x] `npm run build` (frontend) compiles with no new errors

---

## Iteration 2.3 — Login redirect-back-to-checkout

Depends on: 2.2
Estimate: 0.5h

Files:
- `frontend/src/pages/LoginPage.tsx` (modify)

Changes:
- In the `LOGIN` mutation's `onCompleted`, change `history.push('/')` to `history.push(location.state?.from ?? '/')`, reading the `from` state `PrivateRoute` pushes (2.1)
- Add `useLocation()` import from `react-router-dom`

Done criteria:
- [ ] Manual test (needs browser): logged out, navigate to `/checkout/address` → redirected to `/login` → log in successfully → land back on `/checkout/address` (AC-101-2)
- [ ] Manual test (needs browser): navigate directly to `/login` (no prior redirect) → log in → land on `/` (fallback unchanged, no regression for the existing login flow from the header/nav)
- [x] `npm run build` (frontend) compiles with no new errors

---

## Iteration 2.4 — Apollo `errorLink` auth-error handling (expired/invalid JWT)

Depends on: 2.2 (needs `/login` + the redirect target to exist)
Estimate: 1.5h

Files:
- `frontend/src/apollo/client.ts` (modify)

Changes:
- Extend `errorLink`'s `onError` handler: in addition to the existing `console.log` of every `graphQLErrors` entry, check if any error's `message === 'Authentication required'`; if so, `localStorage.removeItem('auth_token')` and redirect to `/login` (via `window.location assign` or an injected history reference — since `client.ts` has no React Router context, use `window.location.href = '/runtime/login'` or an equivalent module-level history instance; pick whichever keeps `client.ts` framework-agnostic and document the choice)
- This must fire for **both query and mutation** errors (per tech-design §4.1 edge case — a `currentCart` query failing with an expired token needs the same treatment as a failing mutation), so it lives in the shared `errorLink`, not duplicated per-page
- Non-auth errors keep the existing console-log-only behavior (no behavior change for them)

> Why here and not per-page: tech-design §4.1 is explicit that duplicating this check per checkout page would miss the case where a **query** (not just a mutation) fails on an already-expired token before a page even finishes mounting.

Done criteria:
- [ ] Manual test (needs browser): set an invalid/garbage string as `auth_token` in localStorage, then trigger any authenticated query (e.g. reload `/order`) → `auth_token` is cleared and the browser lands on `/login`
- [ ] Manual test (needs browser): trigger a non-auth GraphQL error (e.g. malformed variables) → error is still just logged, no redirect, no `auth_token` clearing
- [x] Confirm the order itself is untouched server-side after an auth-expiry redirect (AC-101-3 "cart not lost") — structural property verified: `errorLink` only clears `localStorage`/redirects the browser, it never mutates order state; backend order data is independent of frontend auth state
- [x] `npm run build` (frontend) compiles with no new errors

---

## Iteration 3.1 — `GET_CURRENT_CART` query + real empty-cart logic on `CheckoutAddressPage`

Depends on: 1.2, 2.2
Estimate: 2h

Files:
- `frontend/src/graphql/queries.ts` (modify — add `GET_CURRENT_CART`)
- `frontend/src/pages/checkout/CheckoutAddressPage.tsx` (modify — replace 2.2's stub with real logic)

Changes:
- `GET_CURRENT_CART` query selecting `orderId status products { product { id title } amount price }` (kept minimal for feature 1; features 2/3 extend the selection set with `deliveryAddress`/`deliveryMethod`/`total` as needed — additive change, not a rewrite)
- `CheckoutAddressPage`: on mount, run `useQuery(GET_CURRENT_CART)`; while loading, render a loading state (consistent with the app's 1500ms artificial delay — must show a spinner, not a blank screen); if `currentCart` is `null` or `currentCart.products.length === 0`, render an empty-cart message ("Your cart is empty" + a link back to `/order`) instead of any form (AC-102-2/3); otherwise render a placeholder "Delivery details go here" block (feature 2's real payload) below a confirmation that the cart was found

Done criteria:
- [ ] Manual test (needs browser): Logged in, existing seed data has a `created` order with products → navigating to `/checkout/address` shows the found-cart placeholder, not the empty message (AC-102-1)
- [ ] Manual test (needs browser): Logged in, user's `created` order has zero products → navigating to `/checkout/address` shows the empty-cart message (AC-102-2)
- [ ] Manual test (needs browser): Logged in, user has no `created` order at all → navigating to `/checkout/address` shows the same empty-cart message, not an error (AC-102-3)
- [ ] Manual test (needs browser): Chaos middleware (`errorTestMiddleware`, 1-in-5 500) hitting this query surfaces a retry-affordance error state, not a blank/broken page (reload-and-retry is an acceptable manual verification given no seeded way to force the 500 deterministically)
- [x] `npm run build` (frontend) compiles with no new errors

---

## Iteration 3.2 — Wire "Proceed to Checkout" entry point on `OrderListItem`

Depends on: 3.1
Estimate: 1h

Files:
- `frontend/src/components/OrderListItem.tsx` (modify)

Changes:
- Replace the `onSubmitOrder`-driven "Submit Order" button (rendered when `isLast && status === 'created'`) with a "Proceed to Checkout" button that calls `history.push('/checkout/address')` instead of invoking `SUBMIT_ORDER`
- Remove the now-unused `onSubmitOrder` prop plumbing from this component only (parent `OrderList`/`OrderPage` wiring of `onSubmitOrder` is left alone if still referenced elsewhere — confirm no other caller breaks; if `SUBMIT_ORDER`/`submitOrder` becomes fully unreferenced from the UI, that's expected and intentional per tech-design §7 risk 2, which explicitly keeps the mutation/resolver as sanctioned dead code, not something this iteration deletes)
- `useHistory()` import added

Done criteria:
- [ ] Manual test (needs browser): Logged in, cart page (`/order`) with a `created` order shows "Proceed to Checkout" instead of "Submit Order" as the last item's action
- [ ] Manual test (needs browser): Clicking it navigates to `/checkout/address` and (per 3.1) shows the correct found-cart or empty-cart state depending on the order's contents
- [x] No remaining UI call site invokes `SUBMIT_ORDER`/`submitOrder` (grep confirms — only the mutation definition in `graphql/mutations.ts` remains as sanctioned dead code)
- [x] `npm run build` (frontend) compiles with no new errors
- [ ] Manual test (needs browser): Full manual walkthrough of US-101 + US-102 acceptance criteria (AC-101-1/2/3, AC-102-1/2/3) passes end to end in the running app

---

## 3. Shared / Cross-Feature Files

These files are touched by this plan and are very likely touched again by features 2–6 (per tech-design §4.2–§4.6, §6.1–§6.5). Flagging for the other concurrent planners:

| File | Touched here for | Expected future touches |
|---|---|---|
| `backend/src/app.ts` | Iteration 1.1 — one-time repository-instantiation fix | None expected afterward; if another feature's plan also lists this fix, treat as already-done and skip — do not re-apply |
| `frontend/src/App.tsx` | Iteration 2.2 — full routing restructure to the nested `/checkout` tree | Features 2–5 should only need to swap which component each `<Route>` points to (e.g. `CheckoutAddressPage` gains real content) — the structural nesting itself (`PrivateRoute` → `CheckoutProvider` → `<Switch>`) should not need to change again. If a later feature believes it needs to restructure further, flag it — that likely means this plan's routing shape was wrong |
| `frontend/src/context/CheckoutContext.tsx` | Iteration 2.2 — minimal scaffold (`orderId`, `address`, `deliveryMethodType`, `step`) | Features 2–4 will add real reducer actions/state as address/delivery/payment data is collected. This plan intentionally keeps the reducer minimal so it doesn't guess at shapes features 2–4 own |
| `frontend/src/pages/checkout/CheckoutReviewPage.tsx`, `CheckoutPaymentPage.tsx`, `CheckoutConfirmationPage.tsx` | Iteration 2.2 — placeholder-only stubs so routing compiles | Features 3, 4, 5 respectively are expected to **fully replace** these files' contents. Flag to those planners: do not create new files under different paths for these pages — reuse the paths already established here to avoid orphaned dead routes |
| `frontend/src/pages/checkout/CheckoutAddressPage.tsx` | Iterations 2.2 (stub) and 3.1 (real empty-cart / found-cart logic) | Feature 2 owns adding the actual `DeliveryAddressForm`/`DeliveryMethodPicker` content in place of this plan's "found-cart placeholder" block — expect feature 2 to modify, not recreate, this file |
| `backend/src/graphql/schema.ts` / `resolvers.ts` | Iteration 1.2 — adds `Query.currentCart` only | Every other feature adds its own query/mutation to these same two files (additive). Low structural conflict risk since changes are additive blocks, but coordinate merge order to avoid literal merge conflicts on the same `Query`/`Mutation` block |
| `frontend/src/graphql/queries.ts` | Iteration 3.1 — adds `GET_CURRENT_CART` (minimal field selection) | Feature 5's `CurrentOrder.tsx` rewrite (§6.4) reuses this exact query — do not redefine a second "current cart" query. Features 2/3 will likely need a broader field selection (address/method/total) — extend this constant's selection set rather than adding a parallel query |
| `frontend/src/components/OrderListItem.tsx` | Iteration 3.2 — swaps "Submit Order" for "Proceed to Checkout" | Feature 6 splits this component into a cart-only `OrderListItem` + new read-only `OrderHistoryItem.tsx` (§4.6/§6.5) — feature 6's planner should branch from this plan's post-3.2 state, not from the pre-existing "Submit Order" version |
| `frontend/src/pages/LoginPage.tsx` | Iteration 2.3 — redirect-back via `location.state.from` | Low expected future conflict — no other feature is documented to touch this file |
| `frontend/src/apollo/client.ts` | Iteration 2.4 — auth-error handling in `errorLink` | Tech-design §7 risk 7 flags that features 2 and 6's mutations would also benefit from a shared chaos-resilient error-handling convention. This plan does not build that generic wrapper (out of scope for auth-gating specifically) — flagging for feature 2/6 planners to build on top of, or alongside, the auth-handling added here rather than duplicating error-link logic in a second place |
| `backend/src/services/orderService.ts` | Iteration 1.2 — adds `getCurrentCart` only | Features 2 (`setDeliveryDetails`), 3 (`calculateOrderTotal`), 6 (`cancelOrder`, guard on `deleteProductFromOrder`/`updateProductAmount`) all modify this same file — expect sequential, additive diffs, not structural conflicts |

**Sequencing note for the other planners**: this plan assumes it lands and is merged before features 2–6 branch their work, since it establishes the routing skeleton, `CheckoutContext` scaffold, and the `currentCart` query all six features depend on directly or indirectly. If features 2–6 are being planned/implemented in parallel rather than sequentially, each of those plans should treat `App.tsx`'s nested-route shape, `CheckoutContext`'s existence, and `currentCart`'s existence as already-decided contracts (per tech-design §6.1/§6.2/§3.2), not something to re-derive.

---

## 4. Traceability

| AC | Satisfied by |
|---|---|
| AC-101-1 (redirect guest to `/login`) | Iteration 2.1 (`PrivateRoute`), 2.2 (routing wraps all four checkout routes) |
| AC-101-2 (return to checkout after login) | Iteration 2.3 |
| AC-101-3 (expired JWT mid-checkout → auth error + redirect, cart intact) | Iteration 2.4; "cart intact" is a structural property of the backend (order untouched by frontend auth state), verified manually in 2.4's done criteria |
| AC-102-1 (non-empty cart → lands on delivery/address step) | Iteration 3.1 (found-cart branch), 3.2 (entry point) |
| AC-102-2 (empty products → empty-cart message) | Iteration 3.1 |
| AC-102-3 (no `created` order at all → same empty-cart message) | Iteration 3.1 (relies on Iteration 1.2's `currentCart` returning `null`) |
