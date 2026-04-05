---
tags: [architecture, domain, entity]
related: [[System Overview]], [[Service - GL Engine]], [[Domain - Invoice]]
status: draft
---

# Domain — Tax

## Definition

The **Tax Definition** (الضرائب) structure controls how taxes are applied to items, invoices, and journal entries. The specification requires flexible tax rules including percentage-based, quantity-based, and compound taxes.

## Ownership

**Single source of truth**: Built as a shared systemic configuration, typically managed within the context of the [[Service - GL Engine]] but utilized heavily by Trade modules.

## Key Attributes

| Attribute | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name_ar | TEXT | Arabic name (e.g., ضريبة القيمة المضافة) |
| name_en | TEXT | English name (e.g., Value Added Tax - VAT) |
| tax_type | ENUM | `percentage`, `fixed_amount`, `compound` |
| rate | DECIMAL | E.g., 16.00 for 16% (if percentage) |
| fixed_amount | DECIMAL | E.g., 5.00 per unit (if fixed_amount) |
| is_compound | BOOLEAN | If true, calculated on (Subtotal + Other Taxes) |
| gl_account_id_sales | UUID | GL Account to credit when applied to sales |
| gl_account_id_purchases | UUID | GL Account to debit when applied to purchases |
| is_active | BOOLEAN | Soft disable |

## Compound Taxes

A compound tax is calculated on top of a previously taxed amount.
*Example: Base price $100. Tax A is 10% ($10). Tax B is a 5% Compound Tax.*
*Calculation for B: 5% of ($100 + $10) = $5.50.*

## Tax Declaration (الإقرار الضريبي)

The system computes tax statements dynamically by aggregating journal entries posted to the specific `gl_account_id_sales` and `gl_account_id_purchases` accounts during a specific date range.

## Related Notes

- [[Service - GL Engine]]
- [[Service - Sales Engine]]
- [[Domain - Invoice]]
