# Feature 1: Auth-Gated Checkout

**Parent**: [00-overview.md](00-overview.md)

## Problem

Checkout must only be reachable by an authenticated user — there is no guest checkout in this scope. Today the frontend already gates JWT-bearing GraphQL calls, but there is no explicit "start checkout" entry point, so the gate has never been exercised for this flow.

## User Roles Involved

- **Guest** — unauthenticated visitor
- **User** — authenticated, owns the cart being checked out

## User Stories

### US-101: Redirect unauthenticated users away from checkout

**As a** guest (not logged in)
**I want to** be redirected to the login page if I try to start checkout
**So that** I can log in and continue rather than hitting a broken or empty flow

**Acceptance Criteria:**
- [ ] AC-101-1: Given I am not logged in (no valid `auth_token` in localStorage), when I navigate to the checkout entry point (e.g. clicking "Checkout" from the cart/order page), then I am redirected to `/login` instead of the checkout screen
- [ ] AC-101-2: Given I am redirected to login for this reason, when I successfully log in, then I am returned to checkout (not dropped back to the home page)
- [ ] AC-101-3: Given my JWT has expired mid-checkout (e.g. after 24h token lifetime), when I submit any checkout step, then I see an auth error and am redirected to login, and my in-progress cart is not lost

**Priority**: MUST
**Effort hint**: S

### US-102: Authenticated user can enter checkout

**As a** logged-in user with a non-empty cart
**I want to** click into checkout from my cart/order page
**So that** I can proceed to provide delivery and payment details

**Acceptance Criteria:**
- [ ] AC-102-1: Given I am logged in and my cart (`created`-status order) has at least one product, when I click "Checkout", then I land on the delivery/address step (feature 2)
- [ ] AC-102-2: Given my cart is empty (no products), when I attempt to enter checkout, then I see a message that my cart is empty and checkout is not started
- [ ] AC-102-3: Given I have no `created`-status order at all, when I attempt to enter checkout, then I am shown the same empty-cart message rather than an error

**Priority**: MUST
**Effort hint**: S

## Non-Functional Requirements

- Route guarding must be consistent with the existing pattern (JWT presence check, not a new auth mechanism)
- No new login mechanism — reuse existing `/api/login` / GraphQL `login` mutation and `auth_token` storage

## Out of Scope

- Guest checkout (see overview)
- Registration flow changes (login page itself is unchanged)
- "Remember me" / persistent sessions beyond the existing 24h JWT

## Open Questions

| # | Question | Impact | Assumption |
|---|---|---|---|
| Q1.1 | Should the app redirect back to checkout after login, or is landing on cart/order page acceptable? | UX polish only | Assumed: redirect back to checkout is desired (better UX), flag to architect as a SHOULD if it adds meaningful complexity |
