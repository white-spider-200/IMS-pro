---
tags: [architecture, service, cheques, banking]
related: [[System Overview]], [[Service - GL Engine]], [[Service - Sales Engine]], [[Service - Purchase Engine]]
status: draft
---

# Service — Cheque Engine

## Responsibility

Manages the full lifecycle of **received (incoming) and issued (outgoing) cheques**, with automatic GL journal entry generation.

### Owns
- Bank account definitions
- Received cheque register
- Issued cheque register
- Cheque lifecycle state machine
- Cheque printing templates

### Delegates To
- [[Service - GL Engine]] — auto-posts journal entries for every cheque state transition
- [[Service - Sales Engine]] — received cheques can be entered from Sales/AR
- [[Service - Purchase Engine]] — issued cheques can be entered from Purchases/AP

## Cheque Lifecycle — Received Cheques

```mermaid
stateDiagram-v2
    [*] --> Received : Cheque received from customer
    Received --> Endorsed : Endorse to third party (تجيير)
    Received --> Deposited : Deposit at bank (إيداع)
    Received --> Withdrawn : Withdraw from portfolio (سحب)
    Deposited --> Settled : Bank clears the cheque (تسديد)
    Deposited --> Returned : Bank bounces the cheque (إرجاع)
    Endorsed --> Settled : Third party clears
    Endorsed --> Returned : Third party returns
    Withdrawn --> Received : Return to portfolio
```

## Cheque Lifecycle — Issued Cheques

```mermaid
stateDiagram-v2
    [*] --> Issued : Cheque written to supplier
    Issued --> Settled : Supplier cashes (تسديد)
    Issued --> Returned : Supplier returns (إرجاع)
    Issued --> Cancelled : Voided (إلغاء)
```

## GL Auto-Entries

Every state transition generates automatic journal entries:

### Received Cheque Transitions

| Transition | Debit | Credit |
|---|---|---|
| Received | Cheques Receivable | Accounts Receivable |
| Deposited | Cheques Under Collection | Cheques Receivable |
| Settled (cleared) | Bank Account | Cheques Under Collection |
| Returned (bounced) | Accounts Receivable | Cheques Under Collection |
| Endorsed | Cheques Endorsed | Cheques Receivable |

### Issued Cheque Transitions

| Transition | Debit | Credit |
|---|---|---|
| Issued | Accounts Payable | Cheques Payable |
| Settled (cashed) | Cheques Payable | Bank Account |
| Returned | Cheques Payable | Accounts Payable |
| Cancelled | Cheques Payable | Accounts Payable |

## Batch Operations

Cheque operations can be performed in **bulk** — multiple received cheques can be deposited/endorsed/withdrawn in a single batch operation, generating a single compound journal entry.

## Cheque Printing

Issued cheques can be auto-printed with configurable clauses:
- "Payable to first beneficiary only" (يصرف للمستفيد الأول)
- "Account payee only" (في الحساب)
- "On date" (يصرف بتاريخه)

## Cheque Inquiry

Both received and issued cheques are queryable by:
- Any cheque attribute (number, amount, date, payee, bank)
- Current lifecycle state
- Last transition type

## Related Notes

- [[Service - GL Engine]]
- [[Service - Sales Engine]]
- [[Service - Purchase Engine]]
- [[Domain - Chart of Accounts]]
