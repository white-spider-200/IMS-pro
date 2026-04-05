---
tags: [architecture, adr, database]
related: [[System Overview]], [[ADR-003 Multi-Company Architecture]], [[Infra - Application Stack]]
status: draft
---

# ADR-001 — Database Migration to PostgreSQL

## Context

IMS Pro currently uses **SQLite** (via `better-sqlite3`), which is a single-file, in-process database. While excellent for prototyping and small deployments, it has limitations that conflict with the ERP evolution requirements:

- Single-writer concurrency (WAL mode helps but does not solve multi-user write contention)
- No native user/role-level access control within the database
- No built-in replication or failover
- Schema isolation for multi-company is impractical
- Limited data type richness (no native DECIMAL, JSONB, ARRAY, UUID)

## Decision

Migrate from **SQLite** to **PostgreSQL** as the primary data store.

## Alternatives Considered

### Why not stay with SQLite?
- Cannot scale to multi-user concurrent writes needed for ERP operations (POS, warehouse, accounting all writing simultaneously)
- No path to multi-company tenant isolation at the DB level
- No row-level security for permission enforcement

### Why not MySQL/MariaDB?
- PostgreSQL has superior support for JSONB (needed for flexible item attributes, warehouse allocations)
- PostgreSQL has native UUID type, DECIMAL precision, and array types
- PostgreSQL supports schema-based multi-tenancy natively
- Better transactional DDL (schema migrations are transactional)

### Why not MongoDB?
- ERP is deeply relational (chart of accounts tree, invoice line items, GL entries, AR/AP aging)
- ACID compliance across multi-collection writes is critical for financial data
- Existing codebase is SQL-based — MongoDB would be a full rewrite

### Why not Oracle (as in the original Genius spec)?
- Licensing costs are prohibitive for a small-to-medium deployment
- PostgreSQL offers equivalent capability for this use case at zero licensing cost
- Oracle-specific features (RAC, Exadata) are unnecessary at current scale

## Consequences

### Positive
- True multi-user concurrency with MVCC
- Schema-based multi-tenancy for future multi-company support
- JSONB for flexible data (item attributes, warehouse allocations, compound formulas)
- Row-level security (RLS) for permission enforcement
- Full transactional DDL for safe schema migrations
- Rich indexing (GIN for JSONB, partial indexes, expression indexes)

### Negative
- Requires a running PostgreSQL server (vs. SQLite's zero-config)
- Migration requires data export → transform → import
- Local development setup becomes slightly more complex (Docker recommended)
- `better-sqlite3` API → `pg` / `postgres.js` / Drizzle ORM transition

### Migration Strategy
1. Define PostgreSQL schema matching the existing 17 SQLite tables
2. Add new ERP tables (chart_of_accounts, gl_entries, voucher_types, cheques, etc.)
3. Write a one-time migration script: SQLite → PostgreSQL
4. Update server/db.ts to use a PostgreSQL client library
5. Update all route files to use parameterized queries (already close to this pattern)

## Related Notes

- [[System Overview]]
- [[ADR-003 Multi-Company Architecture]]
- [[Infra - Application Stack]]
