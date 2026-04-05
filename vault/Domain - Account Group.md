---
tags: [architecture, domain, entity]
related: [[System Overview]], [[Service - GL Engine]], [[Domain - Chart of Accounts]]
status: draft
---

# Domain — Account Group

## Definition

An **Account Group** (مجموعة حسابات) is an analytical tool used in the [[Service - GL Engine]]. Unlike the strict parent-child hierarchy of the Chart of Accounts, an Account Group can link arbitrarily dispersed accounts together to track a specific person, department, or project from a multi-faceted perspective.

*Example requirement from the spec: "Track the situation of a person, department, etc., by linking all related accounts into a single group and tracking them."*

## Ownership

**Single source of truth**: [[Service - GL Engine]]

## Key Attributes

| Attribute | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name_ar | TEXT | Arabic name |
| name_en | TEXT | English name |
| description | TEXT | Purpose of the group |
| account_ids | UUID[] | Array of linked GL account IDs |

## Usage Scenario

If "Employee A" takes a loan (Asset Account), incurs travel expenses (Expense Account), and receives a commission (Expense Account), these three disparate accounts sit in completely different branches of the Chart of Accounts tree.

By adding all three to the "Employee A" Account Group, an admin can pull a unified "Group Statement" that pulls journal entries across all three accounts simultaneously to see the net financial footprint of Employee A.

## Related Notes

- [[Domain - Chart of Accounts]]
- [[Service - GL Engine]]
