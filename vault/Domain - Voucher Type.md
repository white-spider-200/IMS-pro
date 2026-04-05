---
tags: [architecture, domain, entity]
related: [[System Overview]], [[Service - GL Engine]], [[Domain - Invoice]]
status: draft
---

# Domain — Voucher Type

## Definition

A **Voucher Type** (نوع السند) controls the behavior, sequencing, and visual representation of any financial or inventory document in the system (e.g., invoices, journal entries, receipts).

Instead of hardcoding "Sales Invoice" or "Payment Receipt", the system relies on user-configurable voucher types, allowing the company to create custom document types (e.g., "Export Sales Invoice" vs "Local Sales Invoice").

## Ownership

**Single source of truth**: [[Service - GL Engine]] (since it owns the core auto-sequencing mechanics used by all modules).

## Key Attributes

| Attribute | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name_ar | TEXT | Arabic name (e.g., فاتورة مبيعات نقدية) |
| name_en | TEXT | English name (e.g., Cash Sales Invoice) |
| module | ENUM | Which engine owns this (e.g., `sales`, `inventory`, `gl`) |
| behavior_type | ENUM | The hardcoded system behavior this maps to (e.g., `sales_invoice`, `journal_entry`) |
| prefix | TEXT | Sequence prefix (e.g., "INV-") |
| sequence_start | INTEGER | Starting number (e.g., 1) |
| sequence_step | INTEGER | Increment amount (e.g., 1) |
| allow_manual_number | BOOLEAN | Can the user type their own sequence number? |
| auto_post_gl | BOOLEAN | Does saving this document automatically post to the GL? |
| default_dr_account_id | UUID | Default debit account (if applicable) |
| default_cr_account_id | UUID | Default credit account (if applicable) |
| is_active | BOOLEAN | Soft disable |

## Sequence Generation Logic

When a module creates a new document (e.g., the Sales Engine creating a Sales Invoice), it requests a sequence number from the GL Engine:

1. Look up the Voucher Type
2. If `allow_manual_number` is true AND the user provided one, validate uniqueness and use it
3. Otherwise, fetch the next sequence number (atomic operation):
   ```sql
   UPDATE voucher_types 
   SET current_value = current_value + sequence_step 
   WHERE id = ? 
   RETURNING current_value;
   ```
4. Format the final string: `{prefix}{current_value}`

## Supported Behavior Types

While users can create unlimited voucher types, they must map to one of the system's hardcoded **behavior types**:

- `journal_entry` (قيد يومية)
- `sales_invoice` (فاتورة مبيعات)
- `sales_return` (مردود مبيعات)
- `purchase_invoice` (فاتورة مشتريات)
- `purchase_return` (مردود مشتريات)
- `inventory_receipt` (سند إدخال)
- `inventory_issue` (سند إخراج)
- `inventory_transfer` (سند نقل)
- `cheque_received` (شيك وارد)
- `cheque_issued` (شيك صادر)
- `incoming_payment` (سند قبض)
- `outgoing_payment` (سند صرف)

## Related Notes

- [[Service - GL Engine]]
- [[Domain - Invoice]]
- [[Domain - Chart of Accounts]]
