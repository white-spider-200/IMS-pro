import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";
import { hashPassword } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for PostgreSQL backend.");
}

export type DbTx = Prisma.TransactionClient;
type PrismaLike = PrismaClient | DbTx;

export const SOFT_DELETE_COLLECTIONS = new Set([
  "warehouses",
  "brands",
  "suppliers",
  "clients",
  "products",
  "product_variants",
  "users",
]);

export const JSON_FIELDS: Record<string, string[]> = {
  product_variants: ["attributes"],
  revenue_invoices: ["items"],
  purchase_invoices: ["items", "warehouse_allocations"],
  transfers: ["movement_ids"],
  inventory_update_records: ["warehouse_allocations", "movement_ids"],
  users: ["warehouse_ids"],
  reservations: [],
};

const ALLOWED_COLLECTIONS = new Set([
  "users",
  "warehouses",
  "brands",
  "categories",
  "suppliers",
  "clients",
  "products",
  "product_variants",
  "inventory_balances",
  "stock_movements",
  "reservations",
  "transfers",
  "revenue_invoices",
  "purchase_invoices",
  "transfer_invoices",
  "return_invoices",
  "client_payments",
  "warehouse_expenses",
  "inventory_update_records",
  "supplier_product_relations",
]);

function db(tx?: DbTx): PrismaLike {
  return tx ?? prisma;
}

export function assertCollection(collection: string): void {
  if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error(`Unknown collection: ${collection}`);
}

export function modelForCollection(collection: string, tx?: DbTx): any {
  assertCollection(collection);
  return (db(tx) as any)[collection];
}

export async function withTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx));
}

export async function initDb() {
  // Will throw if schema is missing
  await prisma.users.count();
  const admin = await prisma.users.findUnique({ where: { email: "admin@ims.local" } });
  if (!admin) {
    const now = new Date().toISOString();
    await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email: "admin@ims.local",
        password_hash: hashPassword("admin123"),
        displayname: "Admin",
        role: "admin",
        status: "active",
        created_at: now,
      },
    });
    console.log("[DB] Default admin created: admin@ims.local / admin123");
  }
}

export function serializeRow(collection: string, data: Record<string, any>): Record<string, any> {
  const result = { ...data };

  if (collection === "users") {
    if (result.displayName !== undefined) {
      result.displayname = result.displayName;
      delete result.displayName;
    }
    if (result.photoURL !== undefined) {
      result.photourl = result.photoURL;
      delete result.photoURL;
    }
  }

  const fields = JSON_FIELDS[collection] || [];
  for (const field of fields) {
    if (result[field] !== undefined && typeof result[field] !== "string") {
      result[field] = JSON.stringify(result[field]);
    }
  }

  return result;
}

export function deserializeRow(collection: string, row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const result = { ...row };

  const fields = JSON_FIELDS[collection] || [];
  for (const field of fields) {
    if (typeof result[field] === "string") {
      try {
        result[field] = JSON.parse(result[field]);
      } catch {
        // keep as string
      }
    }
  }

  if (collection === "users") {
    if (result.displayname !== undefined) {
      result.displayName = result.displayname;
      delete result.displayname;
    }
    if (result.photourl !== undefined) {
      result.photoURL = result.photourl;
      delete result.photourl;
    }
  }

  return result;
}

export async function getAllRows(collection: string): Promise<any[]> {
  const model = modelForCollection(collection);
  const rows = await model.findMany({ orderBy: { id: "desc" } });
  return rows.map((r: any) => deserializeRow(collection, r));
}

