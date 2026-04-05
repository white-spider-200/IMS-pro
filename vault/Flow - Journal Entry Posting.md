---
tags: [architecture, flow, gl]
related: [[Service - GL Engine]], [[Domain - Chart of Accounts]], [[Domain - Fiscal Period]], [[Domain - Voucher Type]]
status: draft
---

# Flow — Journal Entry Posting

## Overview

This represents the foundational posting mechanism into the **GL Engine**. Almost all other transactional flows (Sales Posting, Receipts, Cheque Settlements) eventually trigger this flow.

## Sequence

```mermaid
sequenceDiagram
    participant Caller as (e.g. Sales, Purchases, API)
    participant GL as GL Engine
    participant DB as PostgreSQL
    
    Caller->>GL: postJournalEntry({ date, voucherTypeId, lines[] })
    
    GL->>DB: Check fiscal period for 'date'
    DB-->>GL: Period status
    
    alt Status != open
        GL-->>Caller: ERROR: Period is closed
    end
    
    GL->>GL: Validate Double-Entry Math: SUM(debits) == SUM(credits)
    
    alt Math fails
        GL-->>Caller: ERROR: Unbalanced entry
    end
    
    GL->>GL: Validate Leaf Accounts
    GL->>DB: Verify all targeted account IDs exist and are is_leaf = true
    
    alt Contains non-leaf account
        GL-->>Caller: ERROR: Cannot post to parent account
    end
    
    GL->>DB: Fetch Next Voucher Sequence (for voucherTypeId)
    DB-->>GL: formatted_voucher_number (e.g. JE-1090)
    
    GL->>DB: BEGIN TRANSACTION
    GL->>DB: INSERT into gl_entries (header)
    GL->>DB: INSERT into gl_entry_lines (debits & credits)
    GL->>DB: COMMIT TRANSACTION
    
    GL->>GL: Emits Event: "gl.entry.posted"
    GL-->>Caller: SUCCESS (returns entryId, voucherNumber)
```

## Validations Performed

1. **Date Bounds**: Falls within an `open` fiscal period.
2. **Balance Math**: Total Debits equal Total Credits.
3. **Leaf Only**: Parent accounts are purely for aggregation; only leaf nodes can receive direct inserts.
4. **Currency Handling**: If lines are mixed currency, all must convert to base_currency (via exact exchange rates) and balance in the base currency space.
5. **Cost Centers**: If an account requires Cost Center assignment, validate that the lines provide proportional cost center allocations matching the line total.

## Related Notes

- [[Service - GL Engine]]
- [[Domain - Chart of Accounts]]
- [[Domain - Fiscal Period]]
- [[Flow - Sales Invoice Posting]]
