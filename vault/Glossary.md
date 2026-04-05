---
tags: [architecture, reference, glossary]
related: [[System Overview]]
status: draft
---

# Glossary

## Domain Terms

| Term | Arabic | Definition |
|---|---|---|
| **General Ledger (GL)** | الأستاذ العام | The master accounting record. All financial transactions ultimately post here as journal entries. |
| **Chart of Accounts** | هيكل الحسابات | A hierarchical tree of accounts (assets, liabilities, equity, revenue, expenses) that defines the company's financial structure. |
| **Journal Entry** | قيد يومية | A double-entry record: one or more debit lines and one or more credit lines that must balance. |
| **Voucher** | سند | A document authorizing a financial transaction (payment, receipt, journal entry). |
| **Fiscal Period** | الفترة المالية | A time range (typically a year or quarter) for which financial records are kept and reported. |
| **Cost Center** | مركز التكلفة | A division, department, branch, or project to which costs are allocated for tracking purposes. |
| **Profit Center** | مركز الربح | Same as cost center but focused on revenue and profit tracking. |
| **Account Group** | مجموعة حسابات | A cross-account grouping that lets you track a person, department, or concept across multiple GL accounts. |
| **Trial Balance** | ميزان المراجعة | A report listing all account balances to verify that debits equal credits. |
| **Balance Sheet** | الميزانية العمومية | A snapshot of assets, liabilities, and equity at a point in time. |
| **Income Statement** | قائمة الدخل | Revenue minus expenses for a period. |
| **P&L** | الأرباح والخسائر | Profit and Loss statement — another name for income statement. |

## Inventory Terms

| Term | Arabic | Definition |
|---|---|---|
| **Product** | منتج | A generic item (e.g., "iPhone 15 Pro"). |
| **Product Variant** | صنف | A specific SKU of a product (e.g., "iPhone 15 Pro, 256GB, Blue"). |
| **SKU** | — | Stock Keeping Unit — a unique identifier for a product variant. |
| **Barcode** | باركود | A scannable code on a physical item, linked to a product variant. |
| **Cost Layer** | طبقة التكلفة | A record of stock received at a specific unit cost, used for COGS calculation. |
| **COGS** | تكلفة البضاعة المباعة | Cost of Goods Sold — the cost of inventory that was sold. |
| **Weighted Average** | متوسط الكلفة المرجح | Costing method: total cost ÷ total quantity across all layers. |
| **FIFO** | الداخل أولاً خارج أولاً | First In, First Out — deplete oldest cost layers first. |
| **LIFO** | الداخل أخيراً خارج أولاً | Last In, First Out — deplete newest cost layers first. |
| **BOM** | معادلة تصنيع | Bill of Materials — components that make up an assembled product. |
| **Reorder Point** | حد إعادة الطلب | Stock level at which a replenishment order should be placed. |
| **Stock Movement** | حركة مخزنية | Any change to inventory quantity (receipt, issue, transfer, adjustment). |
| **Write-Off** | شطب | Removing damaged/expired/lost stock from inventory. |
| **Physical Count** | جرد | Physical inventory audit — counting actual stock and reconciling with system records. |

## Trade Terms

| Term | Arabic | Definition |
|---|---|---|
| **Accounts Receivable (AR)** | الذمم المدينة | Money owed to the company by customers. |
| **Accounts Payable (AP)** | الذمم الدائنة | Money the company owes to suppliers. |
| **Proforma Invoice** | طلب بيع | A quotation/sales order — not a financial document until converted. |
| **Credit Limit** | حد التسهيل | Maximum AR balance allowed for a customer before sales are blocked. |
| **Aging Report** | تقرير أعمار الذمم | Receivables or payables broken down by how long they've been outstanding. |
| **Sales Commission** | عمولة المندوب | Percentage of sales value paid to the sales representative. |
| **Bonus** | بونص | Free additional units given with a purchase (e.g., buy 10 get 1 free). |
| **Delivery Fee** | رسم التوصيل | Charge for delivering goods to the customer. |

## Cheque Terms

| Term | Arabic | Definition |
|---|---|---|
| **Received Cheque** | شيك وارد | A cheque received from a customer as payment. |
| **Issued Cheque** | شيك صادر | A cheque written to a supplier as payment. |
| **Endorse** | تجيير | Transfer a received cheque to a third party. |
| **Deposit** | إيداع | Submit a cheque to the bank for collection. |
| **Settle** | تسديد | A cheque has been cleared/cashed by the bank. |
| **Bounce/Return** | إرجاع | A cheque has been rejected by the bank (insufficient funds, etc.). |

## Technical Terms

| Term | Definition |
|---|---|
| **Idempotency Key** | A unique key sent with every write operation to prevent duplicate processing. |
| **SSE** | Server-Sent Events — a one-way real-time push channel from server to browser. |
| **JWT** | JSON Web Token — a stateless authentication token. |
| **Optimistic Concurrency** | Using a version field to detect and resolve concurrent write conflicts. |
| **Cost Layer Depletion** | The process of selecting which cost layers to reduce when stock is issued. |
| **Schema-Based Tenancy** | Multi-company isolation using separate PostgreSQL schemas per company. |
| **RTL** | Right-to-Left — text direction for Arabic language interfaces. |

## Related Notes

- [[System Overview]]
