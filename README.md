<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# IMS Pro - Local Setup Guide

This guide explains how anyone can run the project and prepare PostgreSQL on their own computer.

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL (running locally, default port `5432`)

Project structure:
- `frontend/` React + Vite app
- `backend/` Express API + Prisma + PostgreSQL
- `backend/prisma/` Prisma schema and ORM setup

## First-Time Setup (New Machine)

1. Install dependencies from the project root:
   ```bash
   npm install
   ```
2. Create the local environment file:
   - Copy `.env.example` to `.env.local`
   - Set a valid PostgreSQL connection string in `DATABASE_URL`
   - Example:
     ```env
     DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/ims_pro?schema=public"
     ```
3. Create the database in PostgreSQL (if it does not already exist):
   ```sql
   CREATE DATABASE ims_pro;
   ```
4. Apply the Prisma schema to your local DB:
   ```bash
   npx prisma --config backend/prisma.config.ts db push
   ```
5. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
6. Start the project:
   ```bash
   npm run dev
   ```

On first startup, the backend creates a default admin user automatically.

Default login:
- `admin@ims.local`
- `admin123`

## Next Runs

1. Start PostgreSQL.
2. Run:
   ```bash
   npm run dev
   ```

If you did not create `.env.local`, set `DATABASE_URL` in your shell before `npm run dev`.
