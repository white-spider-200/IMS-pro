---
tags: [architecture, adr, roadmap]
related: [[System Overview]], [[Phase Plan - Evolution Roadmap]], [[Service - GL Engine]], [[Service - Inventory Engine]]
status: draft
---

# ADR-002 — Phased Module Rollout

## Context

The Genius ERP specification defines 6 core modules. Attempting to build all simultaneously would be impractical — each module has deep domain logic, and modules have dependencies on each other (Sales depends on Inventory and GL; POS depends on Sales).

IMS Pro already has working implementations for Inventory, Buy/Sell, Returns, and basic Accounting. The evolution must leverage this existing work.

## Decision

Deliver modules in **four phases**, ordered by dependency graph and business priority:

| Phase | Modules | Rationale |
|---|---|---|
| **Phase 1: Foundation** | Infra (PostgreSQL migration) + General Ledger | GL is the dependency root — every other module posts entries to it |
| **Phase 2: Inventory** | Warehouse / Inventory (evolved) | Already partially built; needs BOM, 6 costing methods, serial/expiry, units |
| **Phase 3: Trade** | Sales & AR + Purchases & AP | Both depend on GL + Inventory; natural pair |
| **Phase 4: Extensions** | POS + Cheque Management | POS is a Sales extension; Cheques bridge Sales + Purchases |

## Alternatives Considered

### Why not build everything in parallel?
- Module dependencies create blocking chains (can't test Sales without GL entries)
- Resource bottleneck — single team cannot meaningfully parallelize 6 interconnected modules
- Risk of integration failures when merging independent modules

### Why not start with Sales (highest user-facing value)?
- Sales posts journal entries to GL — without GL, accounting entries are orphaned
- Sales deducts inventory — without the evolved inventory engine, costing is wrong
- Starting with Sales would force stubbing GL and Inventory, creating technical debt

### Why GL before Inventory?
- Inventory already partially works (from IMS Pro); GL does not exist at all
- GL is the universal dependency — building it first unblocks all other modules
- Financial correctness (chart of accounts, voucher types, journal entries) must be established before any transactional module posts entries

## Consequences

### Positive
- Each phase produces a deployable, testable increment
- Dependencies are satisfied before dependent modules start
- Existing IMS Pro functionality is preserved and enhanced (not discarded and rebuilt)

### Negative
- Full ERP capability is not available until Phase 4 completion
- Users of POS and Cheques must wait until later phases
- Phase 1 (GL + infra) delivers limited user-facing value — mostly foundational work

## Related Notes

- [[System Overview]]
- [[Phase Plan - Evolution Roadmap]]
- [[Service - GL Engine]]
- [[Service - Inventory Engine]]
