# IMS-pro (Inventory Management System)

An AI-powered Inventory Management System built with a modern web stack, featuring real-time synchronization, automated stock reservations, and multi-role dashboards.

## Project Overview

- **Purpose**: A comprehensive inventory management solution for tracking products, variants, warehouses, and stock movements.
- **Main Technologies**:
  - **Frontend**: React 19, Vite 6, Tailwind CSS 4, Framer Motion, Lucide React, Recharts, Sonner.
  - **Backend/Worker**: Express (serving as a dev server and background worker), tsx.
  - **Database & Auth**: Firebase (Firestore, Authentication).
  - **AI Integration**: Gemini API (`@google/genai`).
- **Architecture**:
  - **SPA Architecture**: React Router for navigation and role-based views.
  - **Service-Oriented Logic**: Core inventory operations (reservations, transfers, receipts) are encapsulated in `src/services/inventoryService.ts` using Firestore transactions for data integrity.
  - **Background Worker**: `server.ts` includes a background task that periodically checks and expires stale stock reservations in Firestore.
  - **Real-time Data**: Uses Firestore's `onSnapshot` for live updates across the application.
  - **Demo Mode**: A built-in demo mode (`src/demo/`) allows for testing and presentation without a live Firebase connection.

## Building and Running

### Prerequisites
- Node.js (v18+)
- A Google Gemini API Key
- Firebase Project (configured in `firebase-applet-config.json`)

### Commands
- **Install Dependencies**: `npm install`
- **Development**: `npm run dev`
  - *Note*: This starts the `tsx server.ts` script, which handles both the Vite dev server and the background reservation worker.
- **Build**: `npm run build`
- **Lint**: `npm run lint` (uses `tsc` for type checking)
- **Preview**: `npm run preview`

### Environment Variables
- `GEMINI_API_KEY`: Required for AI-powered features. Should be placed in `.env.local`.

## Development Conventions

- **State Management**: Uses React hooks (`useState`, `useEffect`) and Firestore real-time listeners.
- **UI Components**: 
  - **Dynamic CRUD**: `MasterDataPage.tsx` provides a generic interface for managing collections like brands, categories, products, etc.
  - **Styling**: Tailwind CSS 4 for utility-first styling.
- **Data Integrity**: 
  - Critical stock operations (receipt, transfer, reserve) MUST use `InventoryService` in `src/services/inventoryService.ts` to ensure ACID compliance through Firestore transactions.
  - Idempotency keys are used for stock movements to prevent duplicate processing.
- **Testing**:
  - Reproduce bugs using scripts or manual verification in "Demo Mode" before applying fixes.
  - Ensure any new Firestore operations are handled within transactions if they involve multiple document updates.

## Key Files & Directories

- `server.ts`: Entry point for the dev server and background worker.
- `src/App.tsx`: Main routing and global state (data synchronization).
- `src/services/inventoryService.ts`: Core business logic for inventory.
- `src/pages/`: Role-specific dashboards (Admin, Manager, Procurement, Inventory).
- `src/demo/`: Mock data and logic for the application's demo mode.
- `firestore.rules`: Security rules for Firestore data access.
