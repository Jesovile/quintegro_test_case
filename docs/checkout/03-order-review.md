# Feature 3: Order Review Step

**Parent**: [00-overview.md](00-overview.md)

## Problem

Before charging a card, the user needs one screen that summarizes the order — items, delivery address, delivery method, total — so they can confirm it's correct before paying.

## User Roles Involved

- **User** — reviews and confirms before payment

## User Stories

### US-301: View order summary and confirm before paying

**As a** user who has entered address and delivery method
**I want to** see a summary of my order and explicitly confirm it
**So that** I know what I'm about to pay for before payment happens

**Acceptance Criteria:**
- [x] AC-301-1: Given I completed the delivery step, when I land on the review screen, then I see the cart line items, the delivery address, the delivery method, and the final total (items + delivery fee)
- [x] AC-301-2: Given the total is shown, when I check it, then it equals items subtotal + delivery fee, matching the existing `OrderSum` calculation extended with the delivery cost
- [x] AC-301-3: Given everything looks correct, when I click "Confirm and Pay", then I am taken to the payment step (feature 4) with the reviewed data carried forward

**Priority**: MUST
**Effort hint**: S

## Non-Functional Requirements

- Review is a distinct step (not merged into the address form or the payment form), per explicit product decision
- Monetary values use the same currency formatting as the existing `OrderSum` component

## Out of Scope

- Editing address/delivery/quantities from the review screen — to change anything, the user goes back to the relevant earlier step
- Re-validating the cart against concurrent changes from another tab/session (edge case, not handled in v1)
- Promo code entry on this screen

## Data Entities Involved

```
Reads existing Order line items + DeliveryAddress + DeliveryMethod (from feature 2) — no new entity, this is a display/confirmation step
```

## Open Questions

None — kept intentionally minimal.
