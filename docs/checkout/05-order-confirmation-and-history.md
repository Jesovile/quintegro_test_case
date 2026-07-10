# Feature 5: Order Confirmation & Order History Update

**Parent**: [00-overview.md](00-overview.md)

## Problem

Once payment succeeds, the user needs proof the order went through, the cart needs to stop showing items that have already been bought, and the (existing) order-history page needs to reflect the new paid order alongside its delivery and payment details — none of which the current `OrderList`/`OrderPage` support today.

## User Roles Involved

- **User** — sees confirmation and later revisits order history

## User Stories

### US-501: See order confirmation immediately after payment

**As a** user whose payment just succeeded
**I want to** see a confirmation of what I bought and where it's going
**So that** I have closure on the transaction without needing to hunt for it

**Acceptance Criteria:**
- [ ] AC-501-1: Given payment succeeded, when I land on the confirmation view, then I see the order id, the list of purchased items, the delivery address, the delivery method, and the total paid
- [ ] AC-501-2: Given I'm on the confirmation view, when I click through to "My Orders" (or equivalent), then I land on the order history page (US-502) and see this same order listed

**Priority**: MUST
**Effort hint**: S

### US-502: Cart is cleared after a successful order

**As a** user who just completed checkout
**I want to** see my cart empty afterward
**So that** I don't accidentally re-buy or re-see items I already purchased

**Acceptance Criteria:**
- [ ] AC-502-1: Given payment succeeded, when I navigate to the cart/order page afterward, then the previously-checked-out items no longer appear as an active `created`-status cart
- [ ] AC-502-2: Given my cart was cleared post-purchase, when I look at the header cart indicator (`CurrentOrder` component), then it reflects an empty cart, not the stale/hardcoded count it shows today
- [ ] AC-502-3: Given the cart is now empty, when I want to buy again, then the app does not error — it presents an empty-cart state consistent with US-102's AC-102-2

**Priority**: MUST
**Effort hint**: S

### US-503: Orders page shows full order detail, not just line items

**As a** user viewing my order history
**I want to** see each order's delivery address, delivery method, and payment status
**So that** I know exactly what I ordered, where, and whether it's paid

**Acceptance Criteria:**
- [ ] AC-503-1: Given I have one or more paid orders, when I view the orders page, then each order card shows: items, delivery address, delivery method + fee, payment status (Paid), and total
- [ ] AC-503-2: Given I have an unpaid cart alongside paid orders (edge case, e.g. abandoned before checkout), when I view the page, then paid orders and the active cart are visually distinguishable (different status labeling)
- [ ] AC-503-3: Given orders are listed, when there is more than one, then they are ordered most-recent-first

**Priority**: MUST
**Effort hint**: M

## Non-Functional Requirements

- The header cart indicator (`CurrentOrder`) must reflect real cart state going forward — this is a pre-existing stub (`localStorage.getItem('currentItems')` hardcoded to 10) that this feature must correct as a side effect, since a "cart cleared" requirement cannot be honestly satisfied while that stub remains
- No new order can silently reappear as `created` after being paid — status transition must be one-directional except for cancellation (feature 6)

## Out of Scope

- Order receipt emailed or downloadable as PDF
- Editing a placed order's items
- Reordering ("buy again") from history

## Data Entities Involved

```
Extends existing **Order** — read/display of deliveryAddress, deliveryMethod, payment status fields introduced in features 2 and 4
```

## Open Questions

| # | Question | Impact | Assumption |
|---|---|---|---|
| Q5.1 | Does a brand-new user (no seed cart) need a way to end up with a `created` cart at all, given add-to-cart is out of scope? | Affects whether "empty cart after purchase" is even reachable for all test accounts | Assumed acceptable for v1 — existing seed data provides one cart per test user; after it's checked out, the empty state is what's demoed, and getting a *new* cart is out of scope (ties to overview Out of Scope: no add-to-cart) |
