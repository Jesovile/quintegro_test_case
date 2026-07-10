# Implementation Plan — Feature 6: Order Cancellation

**Status**: DRAFT — Phase 4 (Planning) per `ai-workflow` SDLC
**Requirements**: [`06-order-cancellation.md`](06-order-cancellation.md) (US-601, AC-601-1..4)
**Tech design contract**: [`tech-design.md`](tech-design.md) §2.1 (`OrderStatus`), §2.4/§3/§3.3 (`cancelOrder`), §4.6 (this feature's dedicated section), §6.5 (component split)
**Do not deviate from**: the `OrderStatus` union, `cancelOrder` resolver contract, or `OrderHistoryItem.tsx` split defined in tech-design.md §2/§3/§4.6 — those are frozen.

---

## Position in the epic — read this before planning further

Feature 6 is **last** in the read order (overview §3, tech-design §7 risk 8). It has two hard dependencies:

- **Feature 4** (online payment) must have already landed `status: 'paid'`, `PaymentRecord`, `paidAt`, `paymentId` on `OrderRecord`/`OrderDTO`, and the `pay` mutation. Feature 6 cannot produce a cancellable order without it — a `paid` order is a precondition for `cancelOrder`'s status check.
- **Feature 5** (confirmation & history) must have already landed the `OrderHistoryItem.tsx` component split described in tech-design §4.6/§6.5 (read-only rendering for `paid`/`cancelled` orders, replacing `OrderListItem` for those statuses) and the `OrderList.tsx` branching logic that chooses between `OrderListItem` (cart) and `OrderHistoryItem` (history).

**Consequence for this plan**: this feature's iterations **extend** `entities.ts`, `schema.ts`, `resolvers.ts`, `OrderService`, and `OrderHistoryItem.tsx` — none of them are created by this feature. Every iteration below is written as an additive diff on top of what Features 4 and 5 are assumed to have already merged. If Feature 6 is implemented before Feature 4/5 land (e.g. parallel branches), iteration 6.1 and 6.4 will need a rebase — flagged explicitly per iteration below.

> Why additive, not a rewrite: tech-design.md §2 explicitly freezes the shared data model and forbids per-feature reinvention of `Order.status`. Treating every touched file as "extend, don't recreate" is the only way six concurrently-planned features converge on one working `main`.

---

## Shared / Cross-Feature Files

These files are touched by this feature AND by at least one other feature's plan. Anyone merging plans/PRs across features 1–6 should read this table first.

| File | Also touched by | What Feature 6 does to it | Merge risk |
|---|---|---|---|
| `backend/src/types/entities.ts` | Feature 4 (adds `'paid'`, `deliveryAddress`, `deliveryMethod`, `paymentId`, `paidAt`, `PaymentRecord`, etc.) | Adds **only** the `'cancelled'` literal to the `OrderStatus` union (already unioned with `'paid'` per tech-design §2.1 — the design shows both landing together) + `cancelledAt?: number` on `OrderRecord` | **High** — same union type, same file region. This feature's iteration 6.1 must run *after* Feature 4's entities.ts change lands, or the two changes must be squashed into one PR. Do not let two branches both rewrite the `OrderStatus` union independently. |
| `backend/src/graphql/schema.ts` | Features 1–5 (each adds queries/mutations/types) | Adds `cancelled` to the `OrderStatus` GraphQL enum, adds `cancelOrder(orderId: ID!): Order!` to `Mutation` | **Medium** — additive to existing blocks per tech-design §3.2's note ("just edit the existing type Order/Query/Mutation blocks in place"). Low risk if features land in dependency order (1→6); higher risk if branches diverge and need manual reconciliation of the same enum/type block. |
| `backend/src/graphql/resolvers.ts` | Features 1–5 (each adds resolvers); Feature 4 specifically shares the "rethrow, don't swallow" fix requirement | Adds `Mutation.cancelOrder` resolver **without** the legacy generic-catch pattern (§3.3) | **Medium** — same file, different resolver keys, so textually low-conflict, but this feature's resolver sets a rethrow precedent that Feature 4's `pay` resolver must independently also follow (§3.3 calls out both). Coordinate wording of `'Order cannot be cancelled in its current status'` so it isn't redefined differently by two branches. |
| `backend/src/services/orderService.ts` | Feature 2 (`setDeliveryDetails`), Feature 3 (`calculateOrderTotal`), Feature 4 (`pay`-adjacent `transformToDTO` changes) | Adds `cancelOrder()` method; **mandatory** adds `status === 'created'` guard to existing `deleteProductFromOrder`/`updateProductAmount` (tech-design §4.6) | **High** — this is the single most shared backend file in the epic. `transformToDTO` in particular is extended by Feature 4/5 (payment/delivery projection) and this feature doesn't need to touch it further (cancellation doesn't add new DTO fields beyond `status`/`cancelledAt`, and `cancelledAt` is optional-projection, see 6.1 note). Land this feature's guard-hardening iteration (6.2) independently and early if possible — it's a pure security fix with no dependency on Features 4/5 landing first, see note below. |
| `frontend/src/components/OrderHistoryItem.tsx` | Feature 5 (creates it) | **Extends** — adds the "Cancel Order" button, shown only when `status === 'paid'`, wired to a new `cancelOrder` mutation call | **High if built before Feature 5 lands** — this file does not exist until Feature 5 merges. Treat as a hard blocking dependency, not a soft one (see iteration 6.4). |
| `frontend/src/components/OrderList.tsx` | Feature 5 (adds the `created` vs `paid`/`cancelled` branching) | No structural change needed — Feature 5's branching already routes `cancelled` orders to `OrderHistoryItem`; this feature only needs `OrderList` to refetch/re-render after `cancelOrder` completes (local cache update or refetch) | **Low** — read-only dependency on Feature 5's branching, no new branch added by Feature 6. |
| `frontend/src/graphql/mutations.ts` | Features 2/4 (`SUBMIT_DELIVERY_DETAILS`, `PAY`) | Adds `CANCEL_ORDER` mutation | **Low** — additive, different export names, no textual overlap expected. |
| `docs/decisions.md` | All features (tech-design §7.9 requires entries from several features) | Adds one entry: "cancellation does not touch `PaymentRecord.status` — no refund modeling" (tech-design §4.6 edge case) | **Low** — append-only file. |

**Guard-hardening independence note** (for cross-feature scheduling): the `deleteProductFromOrder`/`updateProductAmount` status guard (iteration 6.2) has no functional dependency on `'paid'`/`'cancelled'` existing yet — it only requires `order.status !== 'created'` to be false-checked, which works against the `'submited'`/`'finished'` legacy statuses too. **This iteration can and should be pulled forward and landed independently of the Feature 4/5 dependency**, since it's a standalone security fix (tech-design §4.6: "any authenticated user can call these mutations directly ... via GraphQL Playground"). Recommend the orchestrator schedule 6.2 as an early, low-risk parallel task rather than waiting for the full Feature 4→5→6 chain.

---

## Phase 1 — Backend cancellation capability + guard hardening

**After this phase**: `cancelOrder` is a fully working, tested GraphQL mutation (ownership + status-checked, correct error messages, rethrows real errors per §3.3); the pre-existing quantity/delete mutations reject any call against a non-`created` order. No frontend change yet — verifiable entirely via GraphQL Playground / integration tests.

### Iteration 6.1 — Extend `OrderStatus` with `'cancelled'` and add `cancelledAt`

Depends on: Feature 4's entities.ts change (adds `'paid'` + delivery/payment fields) having landed, OR coordinated same-PR merge with Feature 4 — see Shared Files table.
Estimate: 0.5h

Files:
- `backend/src/types/entities.ts` (modify)

Changes:
- `OrderStatus` union gains `'cancelled'` (alongside `'created' | 'submited' | 'finished' | 'paid'` — the last already added by Feature 4)
- `OrderRecord.cancelledAt?: number` added
- `OrderDTO` — no new field required beyond `status` already carrying `'cancelled'`; `cancelledAt` is intentionally **not** projected to `OrderDTO`/GraphQL per tech-design (no AC asks for it, keeps the DTO output minimal) — flag as `> Why:` below

> Why not project `cancelledAt`: AC-601-2 only requires the status to update and be reflected in the UI; no AC or design section asks the timestamp to be displayed. Adding an unused field increases GraphQL surface area for no product value. If a later feature needs it, it's a one-line additive change.

Done criteria:
- [x] `OrderStatus` type includes `'cancelled'` and compiles alongside Feature 4's `'paid'` addition with no merge conflict left unresolved
- [x] `OrderRecord` has optional `cancelledAt?: number`
- [x] `tsc --noEmit` passes on `backend/`

---

### Iteration 6.2 — ~~Harden `deleteProductFromOrder` / `updateProductAmount` with a status guard~~ (SUPERSEDED — verify only)

**STATUS: owned by Feature 5, iteration 5.1 (`implementation-plan-05.md`), not Feature 6.** Plan-review found this iteration was an exact independent duplicate of plan-05's 5.1 — same file, same two methods, same guard, same error string, both plans claiming "Depends on: none" and instructing early/parallel scheduling. Feature 5 is the canonical owner (its own iteration 5.2, the `OrderHistoryItem.tsx` UI split, hard-depends on this guard landing first, so plan-05 needs it regardless of Feature 6's schedule). Do not re-implement.

Depends on: none
Estimate: 5 min (verification only)

Done criteria:
- [x] Confirm Feature 5's iteration 5.1 guard is present in `backend/src/services/orderService.ts` for both `deleteProductFromOrder` and `updateProductAmount` before starting 6.3/6.4/6.5 — if it hasn't landed yet, block and coordinate with the Feature 5 implementer rather than re-implementing independently here
- [x] If it landed with different wording than `'Order cannot be modified in its current status'`, no action needed — the guard's existence is what matters for Feature 6's purposes, not which feature's PR added it

---

### Iteration 6.3 — `OrderService.cancelOrder` + `Mutation.cancelOrder` resolver + schema

Depends on: 6.1 (needs `'cancelled'` status to exist), Feature 4's `'paid'` status and `pay` mutation landed (a `'paid'` order must exist to cancel)
Estimate: 2h

Files:
- `backend/src/services/orderService.ts` (modify)
- `backend/src/graphql/schema.ts` (modify)
- `backend/src/graphql/resolvers.ts` (modify)

Changes:
- `OrderService.cancelOrder(orderId: string, userId: string): Promise<OrderDTO | null>`:
  ```ts
  async cancelOrder(orderId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order) return null;
    if (order.userId !== userId) return null;
    if (order.status !== 'paid') {
      throw new Error('Order cannot be cancelled in its current status');
    }
    const updatedOrder: OrderRecord = { ...order, status: 'cancelled', cancelledAt: Date.now() };
    this.updateOrder(updatedOrder);
    return this.transformToDTO(updatedOrder);
  }
  ```
  Matches tech-design §2.4/§3.3 exactly: `return null` for not-found/not-owned (resolver turns this into `'Order not found or access denied'`), `throw` for wrong-status (distinct message, per §3.3 table).
- `schema.ts`: add `cancelled` to the GraphQL `OrderStatus` enum (paired with `paid`, per §3.2 — if Feature 4 already added the enum block with `paid`, this iteration just adds the one line); add `cancelOrder(orderId: ID!): Order!` to `extend type Mutation`.
- `resolvers.ts`: add `Mutation.cancelOrder`, following the **new, scoped pattern** mandated by §3.3 — no swallowing try/catch:
  ```ts
  cancelOrder: async (parent: any, { orderId }: { orderId: string }, context: any) => {
    const userId = extractUserIdFromToken(context);
    if (!userId) {
      throw new Error('Authentication required');
    }
    const updatedOrder = await orderService.cancelOrder(orderId, userId);
    if (!updatedOrder) {
      throw new Error('Order not found or access denied');
    }
    return updatedOrder;
  }
  ```
  Note: no try/catch at all — `orderService.cancelOrder`'s own `throw new Error('Order cannot be cancelled in its current status')` propagates unchanged to Apollo, satisfying §3.3's rethrow requirement and AC-601-4 directly (this is the "simply omit the try/catch" option §3.3 explicitly allows).

Done criteria:
- [x] Unit test: `cancelOrder` on a `'paid'` order owned by the caller returns an `OrderDTO` with `status: 'cancelled'`
- [x] Unit test: `cancelOrder` on someone else's order returns `null` (resolver-level test confirms this surfaces as `'Order not found or access denied'`)
- [x] Unit test: `cancelOrder` on a `'created'` or `'cancelled'` order throws `'Order cannot be cancelled in its current status'` (not a generic message) — this is the resolver-level regression test for the §3.3 rethrow requirement, AC-601-4
- [x] Integration/resolver test: GraphQL `mutation { cancelOrder(orderId: "x") { orderId status } }` against a seeded `'paid'` order returns `status: "cancelled"`
- [x] Integration/resolver test: same mutation against a non-owned or wrong-status order returns a GraphQL error with the exact distinguishing message (not `"Failed to cancel order"` or similar generic string)
- [x] Manual verification via GraphQL Playground: calling `cancelOrder` twice on the same order — second call throws the status error, does not silently succeed or crash

---

## Phase 2 — Frontend Cancel action

**After this phase**: a user viewing a `paid` order in order history sees a "Cancel Order" button; clicking it cancels the order with no confirmation dialog, updates the UI immediately, hides the button once cancelled, and shows an error message on failure without changing the displayed status. Fully satisfies AC-601-1 through AC-601-4.

### Iteration 6.4 — `CANCEL_ORDER` mutation + wire into `OrderHistoryItem.tsx`

Depends on: 6.3 (backend mutation must exist), Feature 5's `OrderHistoryItem.tsx` having landed (hard blocking dependency — this file does not exist otherwise)
Estimate: 2h

Files:
- `frontend/src/graphql/mutations.ts` (modify)
- `frontend/src/components/OrderHistoryItem.tsx` (modify — extend, do not recreate; this file is Feature 5's)
- `frontend/src/components/OrderList.tsx` (modify — minor, cache/refetch wiring only)

Changes:
- `mutations.ts`: add
  ```ts
  export const CANCEL_ORDER = gql`
    mutation CancelOrder($orderId: ID!) {
      cancelOrder(orderId: $orderId) {
        orderId
        status
      }
    }
  `;
  ```
**Architecture decision (plan-review M1 fix)**: `OrderList.tsx` owns the `useMutation(CANCEL_ORDER)` call and passes an `onCancel: (orderId: string) => void` callback prop down to `OrderHistoryItem.tsx` — matching the existing `handleDelete`/`handleAmountChange` prop-drilling convention `OrderList.tsx` already uses for `OrderListItem`. `OrderHistoryItem.tsx` does NOT call `useMutation` itself; it only renders the button and calls the passed-in `onCancel` prop plus a local `disabled`/error-display state for its own in-flight/error UI. This resolves the plan's earlier "component-owns-mutation" vs. "parent-owns-mutation" ambiguity in favor of the parent-owns-it shape, since `OrderList`'s `orders` array is the actual source of truth the Done criteria below assume.

- `OrderHistoryItem.tsx`: add a "Cancel Order" `Button`, rendered **only** when `status === 'paid'` (AC-601-1, AC-601-3 — pure function of status), receiving `onCancel: (orderId: string) => void` and `cancelling: boolean` (in-flight flag) and `cancelError?: string` as props from `OrderList.tsx`:
  - `onClick` calls `onCancel(order.orderId)` immediately — **no confirmation dialog**, per explicit out-of-scope note in `06-order-cancellation.md` and AC-601's one-click requirement
  - Button `disabled` while `cancelling` is true (prevent double-click double-submit, same defensive pattern as `PaymentForm`'s Pay-button-disable in Feature 4, tech-design §4.4 AC-402-2)
  - Renders `cancelError` inline if set (reuse existing error-banner convention from `OrderList.tsx`'s query-error rendering) **without the component changing its own displayed status** — AC-601-4
- `OrderList.tsx`: owns `useMutation(CANCEL_ORDER)`. On `onCompleted`, updates the matching order's status to `'cancelled'` in local `orders` state (matches the existing `deleteProductFromOrder`'s `onCompleted` local-state-update pattern already in this file for `OrderListItem`) so the button disappears and any status badge updates without a full `refetch()`. On `onError`, keeps the order's status unchanged and passes the error message down as `cancelError` to the specific `OrderHistoryItem` that triggered it.

> Why local-state update over `refetch()`: matches the existing codebase convention (`deleteProductFromOrder`'s `onCompleted` in `OrderList.tsx` updates state directly rather than refetching) and avoids an extra round-trip through the flaky `errorTestMiddleware`/`delayMiddleware` chaos layer (tech-design §7.7) on every cancel click.

Done criteria:
- [x] `CANCEL_ORDER` mutation defined and exported from `mutations.ts`
- [x] Given a `paid` order rendered via `OrderHistoryItem`, a "Cancel Order" button is visible (AC-601-1)
- [x] Clicking it calls the `onCancel` prop with no intermediate confirmation dialog/modal (verified in component test — no `window.confirm` or dialog component rendered)
- [x] On success (mutation resolves in `OrderList.tsx`), the order's displayed status changes to "Cancelled" and the "Cancel Order" button is no longer rendered (AC-601-2, AC-601-3)
- [x] Given a `cancelled` order, no "Cancel Order" action is rendered at all (AC-601-3) — component test asserts absence
- [x] On mutation error (mock a rejected `CANCEL_ORDER` in `OrderList.tsx`), `cancelError` is passed down and shown, and the order's displayed status is unchanged (AC-601-4) — component test asserts both the error text and that status did not flip
- [x] Button is disabled for the duration of an in-flight cancel request via the `cancelling` prop (no double-submit)
- [x] Calling `cancelOrder` with no/invalid JWT returns the exact string `'Authentication required'` (plan-review N1)

---

### Iteration 6.5 — Chaos-resilience pass on the cancel mutation call

Depends on: 6.4
Estimate: 1h

Files:
- `frontend/src/components/OrderHistoryItem.tsx` (modify)

Changes:
- Ensure the `errorTestMiddleware` 1-in-5 500 (tech-design §7.7 — applies to every checkout-adjacent mutation, `cancelOrder` included) surfaces as the same inline error-message treatment as a real ownership/status error from 6.4, not an unhandled promise rejection or a blank screen
- If a shared `useChaosResilientMutation`-style wrapper is introduced by another feature (tech-design §7.7 recommends one shared convention across `submitDeliveryDetails`/`pay`/`cancelOrder`), reuse it here rather than writing a fourth bespoke error handler — **check with the Feature 2/4 implementers before duplicating this logic**

> Why call this out as its own small iteration rather than folding into 6.4: tech-design §7.7 flags this as a cross-feature convention risk ("reused across all three new mutation call sites so this isn't reimplemented three times with three different qualities of error UI") — worth a dedicated done-criterion so it isn't silently skipped since no AC number calls it out directly for feature 6.

Done criteria:
- [x] Manually simulate a network/500 error on `cancelOrder` (e.g. mock Apollo link to reject) — UI shows the same error-banner treatment as a real business-logic rejection, order status unchanged
- [x] No unhandled promise rejection / console error swallowing the failure silently
- [x] Code review confirms this reuses (or intentionally doesn't yet have available to reuse) the shared chaos-handling convention from Features 2/4, rather than being a fourth divergent implementation

---

## Phase 3 — Documentation & final verification

**After this phase**: feature 6 is fully documented, manually verified end-to-end against every AC, and the epic-wide `docs/decisions.md` reflects the one cancellation-specific non-obvious design call.

### Iteration 6.6 — `docs/decisions.md` entry + manual AC walkthrough

Depends on: 6.3, 6.4
Estimate: 0.5h

Files:
- `docs/decisions.md` (modify — append-only, shared across all 6 features)

Changes:
- Add entry: "Cancelling an order changes only `Order.status` to `'cancelled'`; the underlying `PaymentRecord.status` remains `'succeeded'` — this is a historical fact (the payment did succeed), cancellation is a separate order-level event, and no refund modeling exists in this scope" (verbatim rationale from tech-design §4.6 edge-case note, DoD item in overview §7.9)

Done criteria:
- [x] `docs/decisions.md` contains the cancellation/no-refund-modeling entry
- [x] Manual walkthrough of AC-601-1 through AC-601-4 against the running app (seed a `paid` order via the full Feature 1→5 flow or direct seed data, then cancel it) — all four pass
- [x] Manual verification: a direct GraphQL Playground call to `deleteProductFromOrder`/`updateProductAmount` against a `paid` or `cancelled` order is rejected with the 6.2 guard message (closes the Playground-bypass gap called out in tech-design §4.6)

---

## Summary — Iteration Dependency Graph

```
6.1 (entities.ts: 'cancelled' + cancelledAt)
  └─ depends on Feature 4's entities.ts change

6.2 (guard hardening: deleteProductFromOrder/updateProductAmount)
  └─ no dependency — schedule early, independent of 6.1/6.3/6.4

6.3 (cancelOrder service+resolver+schema)
  └─ depends on 6.1 + Feature 4's 'paid'/pay mutation

6.4 (frontend: CANCEL_ORDER + OrderHistoryItem.tsx wiring)
  └─ depends on 6.3 + Feature 5's OrderHistoryItem.tsx

6.5 (chaos resilience on cancel)
  └─ depends on 6.4

6.6 (decisions.md + manual AC walkthrough)
  └─ depends on 6.3 + 6.4
```

**Total estimate**: ~7h across 6 iterations.

**Recommended scheduling relative to other features**: land 6.2 as early as possible (no dependency, pure security fix per tech-design §4.6/§7.3's spirit of "small, high-priority prerequisite"). Land 6.1/6.3 immediately after Feature 4 merges. Land 6.4/6.5/6.6 immediately after Feature 5 merges. Do not attempt 6.3 or 6.4 against a `main` that hasn't absorbed Feature 4 and Feature 5 respectively — the dependent types/components won't exist yet and the iteration will fail to compile, not just fail tests.
