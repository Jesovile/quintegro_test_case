# Feature 2: Delivery Address & Method Selection

**Parent**: [00-overview.md](00-overview.md)

## Problem

There is currently no way to specify where an order should be delivered or how quickly. The user needs to manually enter a delivery address each checkout (no saved-address book), and choose between two delivery tiers — Regular and Extra — which differ in both price and speed.

## User Roles Involved

- **User** — authenticated, provides address and picks a delivery method

## User Stories

### US-201: Enter delivery address manually

**As a** user in checkout
**I want to** type in my delivery address
**So that** the order can be shipped to the right place

**Acceptance Criteria:**
- [ ] AC-201-1: Given I am on the delivery step, when the form loads, then I see empty fields for: recipient full name, phone number, country/city, street + building, apartment/unit (optional), postal code
- [ ] AC-201-2: Given I leave a required field empty (all except apartment/unit), when I try to proceed, then I see a validation error next to that field and cannot continue
- [ ] AC-201-3: Given I enter an invalid phone number format, when I try to proceed, then I see a validation error and cannot continue
- [ ] AC-201-4: Given all required fields are valid, when I proceed, then my entered address is carried forward to the review step (feature 3) without needing to re-enter it
- [ ] AC-201-5: Given I navigate back from a later checkout step to this one, when the address form re-renders, then my previously entered values are still populated (not cleared)

**Priority**: MUST
**Effort hint**: M

### US-202: Choose delivery method (Regular vs Extra)

**As a** user in checkout
**I want to** choose between Regular and Extra delivery
**So that** I can trade off cost against speed based on my need

**Acceptance Criteria:**
- [ ] AC-202-1: Given I am on the delivery step, when the method options render, then I see exactly two options — "Regular" and "Extra" — each showing its fixed price and its estimated delivery window (e.g. "3–5 days" vs "1–2 days")
- [ ] AC-202-2: Given neither option is selected yet, when I try to proceed, then I cannot continue until I pick one (no silent default)
- [ ] AC-202-3: Given I select "Extra", when I view the order total (on this step or the next), then the higher Extra delivery fee is reflected in the total
- [ ] AC-202-4: Given I select "Regular", when I view the order total, then the lower Regular delivery fee is reflected in the total
- [ ] AC-202-5: Given I change my delivery method selection, when I do so before proceeding, then the displayed total updates immediately to match the newly selected method

**Priority**: MUST
**Effort hint**: S

## Non-Functional Requirements

- Delivery fee for each method is a fixed price (not weight/sum-dependent) — configurable value, not hardcoded in the UI layer, so it can change without a frontend redeploy (design decision for architect)
- Address form must not silently accept obviously malformed data (empty required fields, non-numeric postal code) — client-side validation is sufficient given no address-verification service is in scope

## Out of Scope

- Address book / saved addresses / address reuse across orders
- Self-pickup / in-store pickup option
- Address validation against a real postal/geocoding service
- More than two delivery tiers
- Delivery fee varying by order weight, sum, or destination distance

## Data Entities Involved

```
**DeliveryAddress** (new) — recipientName, phone, country, city, street, building, apartment (optional), postalCode
**DeliveryMethod** (new) — type: 'regular' | 'extra', fixedPrice, estimatedDays (e.g. "3-5" / "1-2")
```

## Open Questions

| # | Question | Impact | Assumption |
|---|---|---|---|
| Q2.1 | What are the actual fixed prices and day ranges for Regular vs Extra? | Needed before UI copy/design can be finalized | Assumed placeholder values for design (e.g. Regular = flat fee X, 3–5 days; Extra = flat fee Y > X, 1–2 days) — exact numbers to be confirmed with the user before implementation |
| Q2.2 | Is postal code format country-specific or a single free-text field? | Affects validation strictness | Assumed free-text field with only "non-empty" validation, since no country selector is otherwise specified |
