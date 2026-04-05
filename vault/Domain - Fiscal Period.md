---
tags: [architecture, domain, entity]
related: [[System Overview]], [[Service - GL Engine]], [[Domain - Chart of Accounts]]
status: draft
---

# Domain — Fiscal Period

## Definition

A **Fiscal Period** (السنة المالية / الفترة المالية) defines the time bounds for accounting operations. It is not strictly tied to a calendar year (e.g., can start in April or October) and can have multiple open periods simultaneously.

## Ownership

**Single source of truth**: [[Service - GL Engine]]

## Key Attributes

| Attribute | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | E.g., "Fiscal Year 2026" |
| start_date | DATE | Not strictly Jan 1st |
| end_date | DATE | Can be overlapping or non-standard duration |
| status | ENUM | `open`, `closed`, `locked` |
| company_id | UUID | Belongs to a specific company |

## Business Rules

1. **Multiple Open Periods**: The system allows multiple fiscal periods to be `open` at the same time.
2. **Posting Constraints**: A journal entry must fall within the date range of an `open` fiscal period. If no open period covers the date, the entry is rejected.
3. **Closing Process**: When a period is closed:
   - No further modifications/postings are allowed for dates within its bounds.
   - P&L accounts (revenues and expenses) are zeroed out into the "Retained Earnings" equity account.
   - Balance Sheet accounts (assets, liabilities, equity) carry their closing balances forward as opening balances in the next subsequent fiscal period (optional: Rollover flag).
4. **Historical Accessibility**: Read-only queries against `closed` periods remain fully accessible for reports and dashboards.

## Related Notes

- [[Service - GL Engine]]
- [[Domain - Chart of Accounts]]
- [[Edge Cases and Failure Scenarios]] (Fiscal Period Close)
