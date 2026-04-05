---
tags: [architecture, edge-case, failure]
related: [[System Overview]], [[Service - Inventory Engine]], [[Service - Sales Engine]], [[Service - GL Engine]]
status: draft
---

# Edge Cases & Failure Scenarios

## Edge — Expired Batch Auto-Freeze

**Scenario**: Items with expiry dates are tracked per batch (cost layer). When a batch's expiry date passes, the system must automatically prevent it from being sold.

**Behavior**:
1. Background worker (existing pattern from IMS Pro reservation expiry) periodically scans `cost_layers` for `expiry_date < NOW()` where `quantity_remaining > 0` and `is_frozen = false`
2. Moves remaining quantity from `available_quantity` → `blocked_quantity` on the relevant `inventory_balances` record
3. Marks the cost layer as `is_frozen = true`
4. Creates a stock movement record of type `adjustment` for audit trail
5. Does NOT create a GL entry — the stock is still owned, just unavailable for sale

**Recovery**: A manual write-off must be performed to remove frozen stock from inventory (which DOES create a GL entry debiting a loss account).

---

## Edge — Concurrent Invoice Posting

**Scenario**: Two users simultaneously sell the last 5 units of the same product from the same warehouse.

**Behavior**: PostgreSQL row-level locks within the transaction ensure that the second transaction waits for the first to commit. If the first sale depletes available stock to 0, the second sale will fail with "Insufficient stock" error. The `version` field on `inventory_balances` provides additional optimistic concurrency protection.

---

## Edge — Fiscal Period Close with Open Invoices

**Scenario**: User attempts to close a fiscal period while there are unpaid invoices or unposted vouchers dated within that period.

**Behavior**: The GL Engine should **warn** but allow closing, provided:
1. All vouchers are posted (no drafts remaining)
2. Unbalanced entries are resolved
3. A confirmation dialog lists all open AR/AP amounts

Balance rollover behavior is configurable:
- **Rollover ON**: Closing balances of balance sheet accounts (assets, liabilities, equity) carry forward; P&L accounts reset to zero
- **Rollover OFF**: All balances remain in the closed period; new period starts clean

---

## Edge — Credit Limit Exceeded During Sale

**Scenario**: A sales invoice would push a customer's AR balance beyond their credit limit.

**Behavior**: Configurable per customer:
- **Block mode**: Invoice creation is rejected with error
- **Warn mode**: Warning displayed, user can override (if they have the `exceed_credit_limit` permission)

Both modes log the event for audit.

---

## Edge — Multi-Currency Rounding

**Scenario**: An invoice is created in a foreign currency. The exchange rate produces a fractional amount in the base currency.

**Behavior**: All amounts are stored with their original currency values. The base currency equivalent is calculated and stored alongside. Rounding differences on the GL entry are posted to a "Foreign Currency Rounding" account.

---

## Edge — POS Offline / Connectivity Loss

**Scenario**: The POS terminal loses network connectivity to the server mid-transaction.

**Behavior** (future consideration): 
- Current architecture requires server connectivity (no offline mode)
- Suspended invoices already exist in server state — if the connection drops mid-save, the transaction did not complete
- The idempotency key prevents duplicate submission on retry
- For future offline support: POS would need a local queue (IndexedDB) that syncs when connectivity resumes

---

## Edge — Re-costing After Purchase Price Change

**Scenario**: A purchase invoice is confirmed at $10/unit. Later, a credit note arrives adjusting the price to $9.50/unit.

**Behavior**:
1. Purchase Engine creates an adjustment record
2. Cost layer for that receipt is updated: `unit_cost = $9.50`
3. All COGS calculations for items sold from that layer are recalculated
4. An adjusting GL entry is posted: DR Accounts Payable / CR COGS (for the $0.50 × qty difference)
5. Revenue invoices that used this cost layer are flagged with "COGS restated"

## Related Notes

- [[Service - Inventory Engine]]
- [[Service - GL Engine]]
- [[Service - Sales Engine]]
- [[Security - Auth and Permissions]]
- [[ADR-004 Costing Engine Strategy]]
