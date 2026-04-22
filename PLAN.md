# Order Split + Checkout Implementation Plan

## Scope

- Split Order page into **Current Orders** and **Order History** sections.
- Implement checkout flow for current order (review → shipping → payment → place).
- Single active cart per user (one `created`/`checkout` order at a time).
- Mock payment behind a `PaymentProvider` interface so a real gateway can drop in later.
- Promo work deferred. Do not remove existing promo code; leave untouched.

## Assumptions / decisions

- Status lifecycle:
  - `created → checkout → submited → finished`
  - `created | checkout → canceled` (terminal; lives in history)
- `checkout` added so UI can block edits while wizard in progress.
- Canceling from checkout is terminal, not a return-to-cart. Canceled orders appear in history with `canceledAt` timestamp, preserving shipping draft for user reference.
- Shipping + payment persisted on the `OrderRecord` itself, not a separate entity.
- Validation double-sided: client for UX, server enforces on `placeOrder`.
- Payment mock: always succeeds unless card number starts with `0000` (for test failure path).
- `PaymentProvider` interface: `charge({ amount, currency, payment }) => { ok, transactionId?, error? }`. `MockPaymentProvider` is the default bind; real provider swaps at DI boundary in `app.ts`.
- Fix pre-existing bug: REST and GraphQL currently build separate in-memory repo instances → state drift. Unify before wiring checkout.
- React Router v5 stays (no upgrade in this plan).

---

## Phase 0 — Repo hygiene (prep)

Goal: safe ground to build on.

- Share one set of repositories between REST and GraphQL in `backend/src/app.ts`.
- Remove dead `/hui` route in `frontend/src/App.tsx`.
- Remove unused `_deleteProduct` mutation hook in `OrderList.tsx`.
- Extract shared GraphQL fragment `OrderFields` to cut duplication in `queries.ts` / `mutations.ts`.

Acceptance:

- Mutating via GraphQL then querying via REST returns same data.
- `tsc` clean, eslint clean.

---

## Phase 1 — Backend data model

Goal: extend order entity, no behavior change yet.

Files:

- `backend/src/types/entities.ts`
  - Extend `OrderRecord.status` union with `'checkout'`.
  - Add `ShippingInfo`, `PaymentInfo`, `placedAt?: number` to `OrderRecord`.
  - Add `CheckoutDraftInput` type.
  - Extend `OrderDTO` to expose shipping/payment/placedAt (payment returns redacted form — last4 only).
- `backend/src/repositories/interfaces.ts` — no new methods; `update` already covers it.
- `backend/src/repositories/implementations.ts`
  - Seed one order with `status: 'finished'` already has `placedAt`; backfill stub data with `placedAt` where `submited|finished`.

Acceptance:

- Types compile. Existing endpoints still green.

---

## Phase 2 — Backend checkout service + payment abstraction

Goal: business logic + swap-ready payment.

Files:

- `backend/src/services/paymentProvider.ts` (new)
  - `interface PaymentProvider { charge(req: ChargeRequest): Promise<ChargeResult> }`
  - `class MockPaymentProvider implements PaymentProvider` — mimic latency (~400ms), fail on `0000…` card.
- `backend/src/services/orderService.ts`
  - `startCheckout(orderId, userId)` — requires status `created`, flips to `checkout`.
  - `updateCheckout(orderId, userId, { shipping?, payment? })` — requires status `checkout`, merges draft. Never stores full PAN — only `{ last4, holderName, brand }`.
  - `placeOrder(orderId, userId)` — requires status `checkout` + valid shipping + valid payment → calls `paymentProvider.charge` → on success sets `submited` + `placedAt`. On failure returns typed error.
  - `cancelCheckout(orderId, userId)` — flip back to `created` (wizard back button / abandon).
  - Constructor injects `PaymentProvider`.
- `backend/src/app.ts` — instantiate `MockPaymentProvider`, wire into `OrderService`.

Acceptance:

- Unit-smokeable through REST calls (see phase 3).
- Card `0000000000000000` returns structured failure, order stays `checkout`.

---

## Phase 3 — Backend REST + GraphQL surface

Goal: expose new ops on both APIs.

REST — `backend/src/controllers/orderController.ts` + `routes/orderRoutes.ts`:

- `POST /api/order/:orderId/checkout/start`
- `PATCH /api/order/:orderId/checkout` — body `{ shipping?, payment? }`
- `POST /api/order/:orderId/checkout/place`
- `POST /api/order/:orderId/checkout/cancel`

GraphQL — `backend/src/graphql/schema.ts` + `resolvers.ts`:

- Types: `Shipping`, `Payment` (redacted), inputs `ShippingInput`, `PaymentInput`, `CheckoutInput`.
- Extend `Order` with `shipping`, `payment`, `placedAt`.
- Extend `OrderStatus` enum with `checkout`.
- Mutations: `startCheckout`, `updateCheckout`, `placeOrder`, `cancelCheckout`.

Swagger annotations updated for new REST routes.

Acceptance:

- Manual curl flow: login → start → patch shipping → patch payment → place → order now in history list.
- GraphQL Playground flow identical.

---

## Phase 4 — Frontend routing + page split

Goal: two-tab order view, no checkout yet.

Files:

- `frontend/src/App.tsx`
  - `/order` redirects to `/order/current`.
  - Add `/order/current`, `/order/history`.
  - Placeholder `/checkout/:orderId` route (empty page for now).
- `frontend/src/pages/CurrentOrdersPage.tsx` (new)
- `frontend/src/pages/OrderHistoryPage.tsx` (new)
- `frontend/src/components/OrderTabs.tsx` (new) — pill nav between current/history.
- Refactor `OrderList.tsx`:
  - Accept `mode: 'current' | 'history'` prop.
  - Filter orders by status. Current = `created | checkout`. History = `submited | finished`.
  - In history mode: read-only (no qty controls, no delete, no submit). Filter = `submited | finished | canceled`. Sort desc by `canceledAt ?? placedAt ?? createAt`.
  - In current mode: filter = `created | checkout`. Replace inline "Submit Order" button with "Proceed to Checkout" → `history.push('/checkout/' + orderId)`.
- `OrderListItem.tsx` — add `readOnly` prop, hide controls when true.
- `CurrentOrder.tsx` (header cart badge) — derive count from `GET_ORDERS` (sum of amounts in current order) instead of localStorage stub.

Acceptance:

- Login → `/order` lands on current orders.
- Tab switch to history shows finished orders only, read-only.
- Cart badge reflects real line item count.

---

## Phase 5 — Checkout wizard UI

Goal: working flow on top of phase 2/3 backend.

Files (all new under `frontend/src/components/checkout/`):

- `CheckoutStepper.tsx` — visual steps: Review → Shipping → Payment → Confirm.
- `ReviewStep.tsx` — list items, qty editable, live `OrderSum` (existing). "Next" calls `startCheckout` if status still `created`.
- `ShippingForm.tsx` — required fields: fullName, address, city, zip, country, phone. Controlled form. On "Next": `updateCheckout({ shipping })`.
- `PaymentForm.tsx` — mock fields: cardNumber, holder, expiry (MM/YY), cvv. Client validation: Luhn, expiry future, cvv 3–4 digits. On "Next": `updateCheckout({ payment: { last4, holderName, brand } })` — never sends full PAN beyond this request; backend drops PAN.
- `ConfirmStep.tsx` — summary + "Place order" → `placeOrder`. Show server error inline on failure.

Page:

- `frontend/src/pages/CheckoutPage.tsx`
  - Reads `:orderId`, fetches `GET_ORDER`.
  - Guards: if status `submited|finished` → redirect to history. If not owner → redirect to /order.
  - `useReducer` for wizard state: `{ step, shippingDraft, paymentDraft, error }`.
  - Explicit "Cancel order" button calls `cancelCheckout` → confirm dialog → redirect to `/order/history` with canceled badge. Intra-step back does NOT cancel.

GraphQL:

- `frontend/src/graphql/mutations.ts` — add `START_CHECKOUT`, `UPDATE_CHECKOUT`, `PLACE_ORDER`, `CANCEL_CHECKOUT`.
- Refetch `GET_ORDERS` on successful place so history + current reflect immediately.

Acceptance:

- Happy path: review → shipping → payment → place → redirect to `/order/history`, order visible with status `submited`.
- Failure path: card `0000…` → error shown on Confirm, order stays in `/order/current`, status `checkout`.
- Refresh mid-wizard: drafts already persisted server-side via `updateCheckout`, rehydrate from `GET_ORDER`.

---

## Phase 6 — Polish

- Loading + error states consistent with existing UI (`Loader2`, red banner).
- Disabled state on place button while mutation in flight.
- Empty states: no current order → CTA to browse (out of scope but placeholder).
- Remove unused imports / dead code introduced across phases.
- README updates in `backend/` and `frontend/` for new endpoints/routes.

---

## Out of scope (explicit)

- Promo codes (ignored per request).
- Real payment gateway integration (interface only).
- Product catalog / add-to-cart flow (cart seeded from stubs).
- Multiple concurrent carts per user.
- Order cancellation after `submited`.
- Persistent storage (still in-memory).

## Risks

- In-memory repo shared across requests is fine for demo; restart wipes orders (already true).
- Mock payment latency could surface the 1/5 `errorTestMiddleware` 500s — expected for chaos testing.
- `cancelCheckout` on route leave could surprise user; keep it opt-in via explicit "Cancel" button only.


## TODO

- Check error handlers
- Edge case tests / integration tests using API
-

## Build order checklist

- [ ]  Phase 0 — hygiene
- [ ]  Phase 1 — entity types
- [ ]  Phase 2 — service + payment provider
- [ ]  Phase 3 — REST + GraphQL surface
- [ ]  Phase 4 — routing + page split
- [ ]  Phase 5 — checkout wizard
- [ ]  Phase 6 — polish
