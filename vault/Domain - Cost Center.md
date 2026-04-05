---
tags: [architecture, domain, entity]
related: [[System Overview]], [[Service - GL Engine]], [[Domain - Chart of Accounts]]
status: draft
---

# Domain — Cost Center

## Definition

A **Cost Center** (مركز تكلفة) or **Profit Center** (مركز ربح) is a discrete organizational unit, department, branch, or project to which costs and revenues are allocated. This allows financial reporting to be broken down multi-dimensionally within a single company.

## Ownership

**Single source of truth**: [[Service - GL Engine]]

## Key Attributes

| Attribute | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| center_code | TEXT | Unique code (e.g., "HR-01") |
| name_ar | TEXT | Arabic name |
| name_en | TEXT | English name |
| type | ENUM | `cost`, `profit` |
| parent_id | UUID | For hierarchical cost centers |
| is_active | BOOLEAN | Soft disable |

## Integration with Accounts

When an account is created in the [[Domain - Chart of Accounts]], it can be linked to one or more cost centers.

When a journal entry is posted to an account that is linked to a cost center, the user must specify *which* cost center the amount should be allocated to (or distribute the amount across multiple cost centers as percentages/fixed amounts).

## Hierarchy & Reporting

Cost centers, like GL accounts, can be hierarchical. A "Cost Center Statement" (كشف مراكز التكلفة) aggregates the financial transactions tagged with a specific Cost Center ID over a given timeframe, providing departmental P&L visibility.

## Related Notes

- [[Domain - Chart of Accounts]]
- [[Service - GL Engine]]
