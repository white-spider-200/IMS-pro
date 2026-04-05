---
tags: [architecture, flow, sales, gl, inventory]
related: [[Service - Sales Engine]], [[Service - GL Engine]], [[Service - Inventory Engine]], [[Domain - Invoice]]
status: draft
---

# Flow — Sales Invoice Posting

## Overview

This flow documents what happens when a user posts (confirms) a sales invoice. It is the most cross-cutting flow in the system, touching Sales, Inventory, GL, and AR.

## Actors

- **User**: Sales clerk or authorized user
- **Sales Engine**: Orchestrates the process
- **Inventory Engine**: Deducts stock and calculates COGS
- **GL Engine**: Creates the journal entry

## Sequence

```mermaid
sequenceDiagram
    participant User
    participant Sales as Sales Engine
    participant Inv as Inventory Engine
    participant GL as GL Engine
    participant DB as PostgreSQL
    
    User->>Sales: Post Invoice (items, client, discounts, payment)
    
    Sales->>Sales: Validate inputs
    Sales->>Sales: Apply discount engine (bonus, per-item, per-invoice, customer, quantity)
    Sales->>Sales: Calculate subtotal, tax, total
    Sales->>Sales: Check idempotency key
    
    Sales->>DB: Check client credit limit
    DB-->>Sales: current AR balance
    Sales->>Sales: Enforce credit control (block/warn)
    
    Sales->>Inv: issueStock(items[])
    Inv->>Inv: Check availability per warehouse
    Inv->>Inv: Deplete cost layers (per warehouse costing method)
    Inv->>Inv: Calculate COGS per item
    Inv-->>Sales: COGS breakdown
    
    Sales->>Sales: Calculate gross profit = subtotal - COGS
    
    Sales->>GL: postJournalEntry(lines)
    Note right of GL: DR: Accounts Receivable (total)
    Note right of GL: CR: Sales Revenue (subtotal)
    Note right of GL: CR: VAT Payable (tax)
    Note right of GL: DR: COGS (cogs_amount)
    Note right of GL: CR: Inventory (cogs_amount)
    GL-->>Sales: Entry posted
    
    Sales->>DB: Create revenue_invoice record
    Sales->>DB: Create transfer record
    Sales->>DB: Update client AR balance
    
    alt Payment received with invoice
        Sales->>DB: Create client_payment record
        Sales->>GL: postJournalEntry(payment entry)
        Note right of GL: DR: Cash/Bank
        Note right of GL: CR: Accounts Receivable
    end
    
    Sales->>DB: Log activity (audit trail)
    Sales->>Sales: Broadcast SSE update
    Sales-->>User: Invoice posted successfully
```

## Transaction Boundary

The **entire flow** executes within a single PostgreSQL transaction. If any step fails (insufficient stock, credit limit exceeded, GL validation error), the entire operation rolls back — no partial state.

## Related Notes

- [[Service - Sales Engine]]
- [[Service - Inventory Engine]]
- [[Service - GL Engine]]
- [[ADR-004 Costing Engine Strategy]]
- [[Domain - Invoice]]
