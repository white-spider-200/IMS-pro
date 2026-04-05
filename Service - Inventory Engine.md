---
tags: [architecture, service, inventory]
related: [[System Overview]], [[Domain - Item]], [[ADR-004 Costing Engine Strategy]], [[Service - GL Engine]]
status: draft
---

# Service — Inventory Engine

## Responsibility

Manages **all physical stock** — items, warehouses, stock levels, cost layers, movements, and inventory auditing.

### Owns
- Products + Product Variants master data
- Warehouse definitions (zones, regions, types)
- Inventory Balances (quantity per variant per warehouse)
- Cost Layers (for costing calculations)
- Stock Movements (full audit trail)
- Reservations (held stock with expiry)
- Units of Measure
- Serial Numbers
- Item Assemblies / BOM formulas
- Reorder levels, min/max quantities

### Does NOT Own
- Customer data → [[Service - Sales Engine]]
- Supplier data → [[Service - Purchase Engine]]
- GL accounts or journal entries → [[Service - GL Engine]]
- Invoice documents → owned by respective trade modules

## Interface

### Inbound Operations

| Operation | Caller | Description |
|---|---|---|
| `receiveStock(variant, warehouse, qty, cost, batch)` | Purchase Engine | Add stock from supplier receipt |
| `issueStock(variant, warehouse, qty)` | Sales Engine, POS | Deduct stock for sale |
| `transferStock(variant, fromWH, toWH, qty)` | Warehouse UI | Inter-warehouse movement |
| `adjustStock(variant, warehouse, delta, reason)` | Inventory UI | Manual adjustment (shrinkage, etc.) |
| `writeOff(variant, warehouse, qty, reason)` | Inventory UI | Damage/scrap write-off |
| `reserveStock(variant, warehouse, qty, expiry)` | Sales Engine | Temporarily hold stock |
| `releaseReservation(reservationId)` | Sales Engine / Worker | Cancel or fulfill a reservation |
| `assembleBOM(product, warehouse, qty)` | Manufacturing UI | Create assembled product from components |
| `disassembleBOM(product, warehouse, qty)` | Manufacturing UI | Break assembled product into components |
| `physicalCount(warehouse, counts[])` | Inventory UI | Submit physical inventory count |

### Queries

| Query | Description |
|---|---|
| `getBalance(variant, warehouse)` | Current stock level |
| `getCostLayers(variant, warehouse)` | Active cost layers |
| `getAvgCost(variant)` | Weighted average cost |
| `getMovementHistory(filters)` | Stock movement audit trail |
| `getSlowMovingItems(days, warehouse)` | Items below velocity threshold |
| `getExpiringBatches(days, warehouse)` | Batches approaching expiry |
| `getReorderAlerts(warehouse)` | Items below reorder point |

## Key Flows

- [[Flow - Stock Issue with Costing]]
- [[Flow - Physical Inventory Count]]
- [[Flow - BOM Assembly]]
- [[Flow - Inter-Warehouse Transfer]]

## GL Integration

Every stock movement that has a financial impact generates a journal entry to the GL Engine:

| Movement | Debit | Credit |
|---|---|---|
| Receipt from supplier | Inventory Account | AP / Cash Account |
| Issue for sale | COGS Account | Inventory Account |
| Write-off | Loss/Shrinkage Account | Inventory Account |
| Transfer | Inventory (destination WH) | Inventory (source WH) |
| Adjustment (+) | Inventory Account | Adjustment Income Account |
| Adjustment (-) | Adjustment Expense Account | Inventory Account |

## Failure Strategy

- **Insufficient stock**: Reject issue/transfer with clear error. Never allow negative stock.
- **Concurrent modification**: Optimistic concurrency via `version` field on `inventory_balances` (already exists in IMS Pro). Transaction retries on conflict.
- **Expired batch freeze**: When auto-freeze triggers, the batch's remaining quantity is moved to `blocked_quantity` and cannot be issued → see [[Edge - Expired Batch Auto-Freeze]].
- **Cost layer exhaustion**: If a costing method tries to deplete more than available layers, reject the operation.

## Related Notes

- [[Domain - Item]]
- [[Domain - Cost Layer]]
- [[Domain - Warehouse]]
- [[ADR-004 Costing Engine Strategy]]
- [[Service - GL Engine]]
