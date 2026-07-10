# Checkout Epic — Architecture Decision Log

Non-obvious decisions made during design/implementation of the checkout epic (features 1-6). See `00-overview.md` §7 (Definition of Done) and `tech-design.md` §7 (Open Technical Questions & Risks) for the fuller context behind each entry.

| Date | Decision | Rationale / Source |
|---|---|---|
| 2026-07-10 | Delivery method catalog seeded with placeholder values: Regular = $5.99 fee / "3-5" estimated days, Extra = $14.99 fee / "1-2" estimated days | `tech-design.md` §2.2, §7 risk 1 — Q2.1 in `02-delivery-selection.md` is unresolved; these are architect placeholders pending product sign-off. The catalog is config-driven (`InMemoryDeliveryMethodRepository`), so changing these later is a data change, not a code change. |
