---
tags: [architecture, domain, er-diagram]
related: [[System Overview]], [[Domain - Chart of Accounts]], [[Domain - Item]], [[Domain - Invoice]]
status: draft
---

# Domain — Entity Relationship Overview

## Complete ER Diagram

```mermaid
erDiagram
    COMPANY ||--|{ ACCOUNT : "has chart of accounts"
    ACCOUNT ||--o{ ACCOUNT : "parent-child"
    ACCOUNT ||--o{ GL_ENTRY_LINE : "receives postings"
    ACCOUNT }o--o{ ACCOUNT_GROUP : "belongs to"
    ACCOUNT }o--o{ COST_CENTER : "linked to"
    
    GL_ENTRY ||--|{ GL_ENTRY_LINE : "contains lines"
    GL_ENTRY }o--|| VOUCHER_TYPE : "typed as"
    GL_ENTRY }o--|| FISCAL_PERIOD : "posted in"
    
    PRODUCT ||--|{ PRODUCT_VARIANT : "has variants"
    PRODUCT }o--|| BRAND : "belongs to"
    PRODUCT }o--|| CATEGORY : "classified as"
    CATEGORY ||--o{ CATEGORY : "parent-child"

    PRODUCT_VARIANT ||--o{ ITEM_UNIT : "measured in"
    PRODUCT_VARIANT ||--o{ COST_LAYER : "has cost layers"
    PRODUCT_VARIANT ||--o{ INVENTORY_BALANCE : "stocked in"
    PRODUCT_VARIANT ||--o{ SERIAL_NUMBER : "tracked by"
    PRODUCT_VARIANT ||--o{ INVOICE_LINE : "sold/purchased as"
    
    WAREHOUSE ||--o{ INVENTORY_BALANCE : "holds stock"
    WAREHOUSE ||--o{ STOCK_MOVEMENT : "records movements"
    
    INVOICE ||--|{ INVOICE_LINE : "contains items"
    INVOICE }o--|| CLIENT : "billed to (sales)"
    INVOICE }o--|| SUPPLIER : "received from (purchase)"
    INVOICE ||--o| GL_ENTRY : "posts to GL"
    INVOICE ||--o{ PAYMENT : "paid via"
    
    CLIENT ||--o{ INVOICE : "receives invoices"
    CLIENT ||--o{ PAYMENT : "makes payments"
    CLIENT ||--o{ CHEQUE_RECEIVED : "gives cheques"
    
    SUPPLIER ||--o{ INVOICE : "sends invoices"
    SUPPLIER ||--o{ PAYMENT : "receives payments"
    SUPPLIER ||--o{ CHEQUE_ISSUED : "receives cheques"
    SUPPLIER ||--o| CLIENT : "optionally linked to"
    
    CHEQUE_RECEIVED }o--|| BANK_ACCOUNT : "deposited to"
    CHEQUE_ISSUED }o--|| BANK_ACCOUNT : "drawn from"
    CHEQUE_RECEIVED ||--o{ GL_ENTRY : "posts transitions"
    CHEQUE_ISSUED ||--o{ GL_ENTRY : "posts transitions"
    
    USER ||--o{ PERMISSION : "has permissions"
    USER ||--o{ ACTIVITY_LOG : "tracked by"
    USER }o--o{ WAREHOUSE : "assigned to"

    FISCAL_PERIOD ||--o{ GL_ENTRY : "contains entries"
    FISCAL_PERIOD }o--|| COMPANY : "belongs to"
    
    CURRENCY ||--o{ INVOICE : "denominated in"
    TAX_DEFINITION ||--o{ INVOICE_LINE : "applied to"
```

## Table Count Summary

| Module | Tables | New vs. Existing |
|---|---|---|
| **Core / Shared** | companies, users, permissions, activity_log, currencies, tax_definitions | New (except users) |
| **General Ledger** | accounts, account_groups, gl_entries, gl_entry_lines, voucher_types, voucher_sequences, fiscal_periods, cost_centers, budgets | All new |
| **Inventory** | products, product_variants, brands, categories, warehouses, inventory_balances, stock_movements, reservations, cost_layers, item_units, serial_numbers, assembly_formulas | Existing + new |
| **Sales / AR** | revenue_invoices, invoice_lines, transfers, clients, client_payments, discount_rules, price_levels, commission_rates | Existing + new |
| **Purchases / AP** | purchase_invoices, purchase_orders, suppliers, supplier_product_relations | Existing + new |
| **Cheques** | cheques_received, cheques_issued, bank_accounts, cheque_transitions | All new |

**Total estimated tables**: ~40 (up from 17 in IMS Pro)

## Related Notes

- [[Domain - Chart of Accounts]]
- [[Domain - Item]]
- [[Domain - Invoice]]
- [[System Overview]]
