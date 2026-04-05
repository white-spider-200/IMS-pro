---
tags: [architecture, service, purchases, ap]
related: [[System Overview]], [[Domain - Invoice]], [[Service - GL Engine]], [[Service - Inventory Engine]]
status: draft
---

# Service — Purchase Engine

## Responsibility

Manages the **procurement lifecycle** — from purchase orders to goods receipt to payment — and tracks **Accounts Payable** (AP).

### Owns
- Supplier master data
- Purchase Orders, Purchase Invoices, Purchase Returns
- AP balances and aging
- Supplier-product relations (purchase history)
- Unreceived items tracking

### Does NOT Own
- Product/variant data → [[Service - Inventory Engine]]
- GL accounts → [[Service - GL Engine]]
- Cheque lifecycle → [[Service - Cheque Engine]]

## Interface

| Operation | Description |
|---|---|
| `createPurchaseOrder(order)` | Create a PO to a supplier |
| `receivePurchaseInvoice(invoice)` | Record goods received from supplier |
| `createPurchaseReturn(return)` | Return goods to supplier |
| `recordPaymentToSupplier(supplierId, amount)` | Record outgoing payment |
| `linkSupplierToClient(supplierId, clientId)` | Link when supplier is also a customer |

## Supplier–Customer Link

A unique requirement: if a supplier is also a customer of the company, the two entities can be **linked**. This enables net settlement — offsetting AR balances against AP balances for the same entity.

## GL Integration

On purchase invoice posting:

| Account | Debit | Credit |
|---|---|---|
| Inventory (or Expense) | purchase total | — |
| VAT Receivable | tax amount | — |
| Accounts Payable | — | total including tax |

On payment to supplier:

| Account | Debit | Credit |
|---|---|---|
| Accounts Payable | payment amount | — |
| Cash / Bank | — | payment amount |

## Inventory Integration

On purchase invoice posting, the Purchase Engine calls `Inventory.receiveStock()` which creates cost layers for the received items.

**Re-costing** flow: if the confirmed purchase price changes after initial posting (e.g., after receiving a credit note), the Purchase Engine:
1. Adjusts the purchase invoice amount
2. Triggers `Inventory.recostLayers()` to update cost layers
3. Posts an adjusting GL entry for the cost difference

## Reports

| Report | Description |
|---|---|
| Supplier Statement | Detailed AP activity per supplier |
| AP Aging | Outstanding payables by age bucket |
| Unreceived Items | PO items not yet received |
| Purchase Summary | Total purchases by supplier/period |

## Related Notes

- [[Domain - Invoice]]
- [[Service - GL Engine]]
- [[Service - Inventory Engine]]
- [[Service - Cheque Engine]]
