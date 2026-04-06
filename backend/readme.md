# Database Architecture Guide

This module manages the data layer for the **Genius ERP** system (tailored for IT and Marketing firms).  
The backend uses **PostgreSQL** with **Prisma** as the data access layer for both ORM workflows and advanced SQL execution.

## Tech Stack

- **Database:** PostgreSQL 17
- **ORM:** Prisma
- **Query Engine:** Prisma Client (`@prisma/client`) with Prisma transactions
- **Runtime:** Node.js + TypeScript + Express

## Data Access Strategy

### Prisma ORM (Default Choice)

Use Prisma for the vast majority of backend work.

Use cases:

- Standard CRUD APIs (create, read, update, delete)
- Normal filtering, pagination, sorting
- Relation reads for everyday business flows
- Multi-step operations wrapped in Prisma transactions

```ts
// Example: create a task with Prisma ORM
const newTask = await prisma.task.create({
  data: {
    title: "Ramadan Advertising Campaign",
    type: "MARKETING",
    priority: "HIGH",
    deadline: new Date("2026-04-20"),
  },
});
```

### Raw SQL (Use Only When Needed)

Use raw SQL only for advanced queries where Prisma becomes hard to read, too slow, or cannot express the query cleanly.

Use cases:

- Heavy reports with CTEs, window functions, or complex joins
- Financial analytics (Trial Balance, AR/AP aging, profitability rollups)
- Performance-critical queries after profiling
- PostgreSQL-specific features not convenient in Prisma

```sql
SELECT
  customer_name,
  SUM(amount) FILTER (WHERE due_date > NOW() - INTERVAL '30 days') AS "0-30 days",
  SUM(amount) FILTER (WHERE due_date <= NOW() - INTERVAL '30 days') AS "Over 30 days"
FROM invoices
GROUP BY customer_name;
```

### Practical Rule

- Start with **Prisma ORM** by default.
- Move to **Raw SQL** only for complex reporting or proven performance bottlenecks.
- Keep all raw queries parameterized to prevent SQL injection.

## Schema Overview

The schema is designed to support:

- **Multi-Company readiness:** isolated, scalable data model
- **Role-Based Access (RBAC):** granular roles (Admin, Accountant, Manager, Worker)
- **Audit Trail:** timestamped operational and financial activity

## Setup and Execution

### Environment Configuration

Set your PostgreSQL connection string in `.env.local` or `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/ims_pro"
```

### Prisma Setup

```bash
npm run prisma:pull
npm run prisma:generate
```

### Run the Backend

From project root:

```bash
npm install
npm run dev
```

## Security and Auditing

- **Authentication:** JWT-based auth with hashed passwords (`bcryptjs`)
- **SQL Injection Prevention:** parameterized queries only
- **Accountability:** financial movements are timestamped and traceable to user context

## Notes

- Runtime backend CRUD is Prisma-based.
- Keep using Prisma transactions for multi-step inventory and financial operations.
