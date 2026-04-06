# Backend File Map

This document explains every file currently inside the `backend/` folder and its responsibility.

## Top-Level Backend Files

- `backend/prisma.config.ts`  
Prisma CLI configuration (schema path, migrations path, datasource URL via `DATABASE_URL`).

- `backend/readme.md`  
Backend architecture and setup notes.

- `backend/server.ts`  
Main backend entrypoint:
1. initializes DB bootstrap checks
2. creates HTTP server
3. mounts Vite middleware/static serving
4. starts background workers

## Prisma Schema

- `backend/prisma/schema.prisma`  
Prisma data model definition (tables/models used by runtime).

## Shared Infrastructure (`backend/server`)

- `backend/server/auth.ts`  
Authentication utilities:
- password hash/compare
- JWT sign/verify
- `requireAuth` middleware

- `backend/server/db.ts`  
Shared DB utilities around Prisma:
- transaction helper
- collection model resolver
- serialization/deserialization helpers
- startup DB checks and default admin seed

- `backend/server/prisma.ts`  
Singleton Prisma client setup using PostgreSQL adapter.

- `backend/server/sse.ts`  
Server-Sent Events infrastructure:
- manages connected clients
- broadcasts collection changes

## HTTP Composition

- `backend/server/http/createApp.ts`  
Express app builder:
- JSON middleware
- SSE route
- feature route mounting
- health endpoint

## Feature Modules

### Auth Module
- `backend/server/modules/auth/auth.service.ts`  
Auth business logic (login, current user, profile updates, password change).

- `backend/server/modules/auth/router.ts`  
Auth endpoints under `/api/auth`.

### Collections Module
- `backend/server/modules/collections/router.ts`  
Generic collection CRUD endpoints under `/api/collections`.

### Inventory Module
- `backend/server/modules/inventory/router.ts`  
Inventory transaction endpoints under `/api/inventory`:
- `receive`
- `issue`
- `transfer`
- `buy-order`
- `buy-from-customer`
- `return`

## Workers

- `backend/server/workers/reservationExpiry.worker.ts`  
Background worker that expires old reservations and posts inventory adjustment movements.

