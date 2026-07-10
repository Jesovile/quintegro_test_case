# Feature 6: Order Cancellation

**Parent**: [00-overview.md](00-overview.md)

## Problem

Once an order is paid, the user currently has no way to back out of it. The user needs a simple way to cancel an already-placed (paid) order from the order history page.

## User Roles Involved

- **User** — cancels their own paid order

## User Stories

### US-601: Cancel a paid order

**As a** user viewing my order history
**I want to** cancel an order I already paid for
**So that** I can back out of a purchase I no longer want

**Acceptance Criteria:**
- [ ] AC-601-1: Given I have a paid order, when I view it on the orders page, then I see a "Cancel Order" action on it
- [ ] AC-601-2: Given I click "Cancel Order", when the request succeeds, then the order's status updates to "Cancelled" and this is reflected on the orders page
- [ ] AC-601-3: Given an order is already "Cancelled", when I view it, then no "Cancel Order" action is shown for it
- [ ] AC-601-4: Given the cancellation request fails, when that happens, then I see an error message and the order's status stays unchanged

**Priority**: MUST
**Effort hint**: S

## Non-Functional Requirements

- Same ownership check as existing order endpoints (`userId` match) — a user can only cancel their own orders

## Out of Scope

- Confirmation dialog before cancelling (one click is sufficient for v1)
- Automatic refund processing (no real payment provider to refund from)
- Cancellation reason capture
- Time-boxing cancellation eligibility (no cutoff for v1)
- Cancelling individual line items (whole-order cancellation only)
- Admin-initiated cancellation

## Data Entities Involved

```
Extends existing **Order.status** enum: needs a new 'cancelled' value alongside 'created' | 'submited' | 'finished'
```

## Open Questions

None — kept intentionally minimal.
