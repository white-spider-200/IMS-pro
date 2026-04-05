import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'ims-pro.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!_db) {
        _db = new Database(DB_PATH);
        _db.pragma('journal_mode = WAL');
        _db.pragma('foreign_keys = ON');
    }
    return _db;
}

export function initDb() {
    const db = getDb();

    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      displayName TEXT,
      role TEXT NOT NULL DEFAULT 'worker',
      phone TEXT,
      location TEXT,
      photoURL TEXT,
      warehouse_ids TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      country TEXT,
      manager_id TEXT,
      manual_manager_name TEXT,
      manual_manager_phone TEXT,
      manual_manager_email TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_of_origin TEXT,
      logo_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_code TEXT UNIQUE,
      description TEXT,
      parent_category_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_code TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      country TEXT,
      contact_info TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      client_code TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      location TEXT,
      balance_due REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      credit_balance REAL DEFAULT 0,
      total_billed REAL DEFAULT 0,
      pending_amount REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_modified TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      brand_id TEXT,
      category_id TEXT,
      supplier_id TEXT,
      description TEXT,
      image_url TEXT,
      country_of_origin TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_code TEXT NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      color TEXT,
      size TEXT,
      type TEXT,
      image_url TEXT,
      reorder_threshold REAL,
      unit_cost REAL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_balances (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      available_quantity REAL NOT NULL DEFAULT 0,
      reserved_quantity REAL NOT NULL DEFAULT 0,
      blocked_quantity REAL NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0,
      last_modified TEXT NOT NULL,
      UNIQUE(variant_id, warehouse_id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      batch_id TEXT,
      source_reference TEXT,
      user_id TEXT,
      customer_name TEXT,
      client_id TEXT,
      related_movement_id TEXT,
      transaction_id TEXT,
      notes TEXT,
      status TEXT DEFAULT 'completed',
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      order_reference TEXT,
      expiry_timestamp TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT,
      transfer_type TEXT NOT NULL,
      client_id TEXT,
      customer_name TEXT,
      supplier_id TEXT,
      warehouse_id TEXT,
      from_warehouse_id TEXT,
      to_warehouse_id TEXT,
      product_id TEXT,
      product_variant_id TEXT,
      quantity REAL,
      subtotal REAL DEFAULT 0,
      vat_rate REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      cost_per_unit_at_sale REAL DEFAULT 0,
      cogs_amount REAL DEFAULT 0,
      gross_profit REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      movement_id TEXT,
      movement_ids TEXT,
      revenue_invoice_id TEXT,
      purchase_invoice_id TEXT,
      transfer_invoice_id TEXT,
      movement_out_id TEXT,
      movement_in_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revenue_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      customer_name TEXT,
      client_id TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      vat_rate REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      delivery_fee REAL DEFAULT 0,
      delivery_status TEXT,
      delivery_address TEXT,
      cost_per_unit_at_sale REAL DEFAULT 0,
      cogs_amount REAL DEFAULT 0,
      gross_profit REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      paid_at TEXT,
      warehouse_id TEXT,
      movement_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      supplier_id TEXT,
      supplier_name TEXT,
      product_id TEXT,
      product_variant_id TEXT,
      client_id TEXT,
      requested_quantity REAL DEFAULT 0,
      quantity_purchased REAL DEFAULT 0,
      quantity_from_warehouse REAL DEFAULT 0,
      warehouse_allocations TEXT DEFAULT '[]',
      receiving_warehouse_id TEXT,
      batch_id TEXT,
      unit_cost REAL DEFAULT 0,
      vat_rate REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      items TEXT DEFAULT '[]',
      status TEXT DEFAULT 'received',
      invoice_type TEXT DEFAULT 'purchase',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfer_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      variant_id TEXT,
      quantity REAL DEFAULT 0,
      from_warehouse_id TEXT,
      to_warehouse_id TEXT,
      movement_out_id TEXT,
      movement_in_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS return_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      client_id TEXT,
      client_name TEXT,
      variant_id TEXT,
      product_id TEXT,
      warehouse_id TEXT,
      quantity REAL DEFAULT 0,
      unit_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      return_scope TEXT,
      notes TEXT,
      original_invoice_id TEXT,
      movement_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_payments (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      client_name TEXT,
      direction TEXT NOT NULL,
      scope TEXT,
      invoice_id TEXT,
      invoice_number TEXT,
      receipt_number TEXT,
      amount REAL DEFAULT 0,
      notes TEXT,
      warehouse_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouse_expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      recurrence TEXT NOT NULL,
      start_month TEXT,
      end_month TEXT,
      expense_date TEXT,
      payment_date TEXT,
      payment_method TEXT,
      receipt_number TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_by_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_update_records (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      client_id TEXT,
      client_name TEXT,
      product_id TEXT,
      variant_id TEXT,
      requested_quantity REAL,
      quantity_from_warehouse REAL,
      supplier_quantity REAL,
      warehouse_allocations TEXT DEFAULT '[]',
      receiving_warehouse_id TEXT,
      purchase_invoice_id TEXT,
      movement_ids TEXT DEFAULT '[]',
      status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_product_relations (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      product_id TEXT,
      variant_id TEXT,
      client_id TEXT,
      purchase_invoice_id TEXT,
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      vat_rate REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      warehouse_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

    // Seed default admin user
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@ims.local');
    if (!existing) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const hash = hashPassword('admin123');
        db.prepare(`
      INSERT INTO users (id, email, password_hash, displayName, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'admin@ims.local', hash, 'Admin', 'admin', 'active', now);
        console.log('[DB] Default admin created: admin@ims.local / admin123');
    }
}

// Soft delete collections (set status=inactive)
export const SOFT_DELETE_COLLECTIONS = new Set([
    'warehouses', 'brands', 'suppliers', 'clients', 'products', 'product_variants', 'users',
]);

// JSON fields that need serialization
export const JSON_FIELDS: Record<string, string[]> = {
    product_variants: ['attributes'],
    revenue_invoices: ['items'],
    purchase_invoices: ['items', 'warehouse_allocations'],
    transfers: ['movement_ids'],
    inventory_update_records: ['warehouse_allocations', 'movement_ids'],
    users: ['warehouse_ids'],
    reservations: [],
};

export function serializeRow(collection: string, data: Record<string, any>): Record<string, any> {
    const fields = JSON_FIELDS[collection] || [];
    const result = { ...data };
    for (const field of fields) {
        if (result[field] !== undefined && typeof result[field] !== 'string') {
            result[field] = JSON.stringify(result[field]);
        }
    }
    return result;
}

export function deserializeRow(collection: string, row: Record<string, any>): Record<string, any> {
    if (!row) return row;
    const fields = JSON_FIELDS[collection] || [];
    const result = { ...row };
    for (const field of fields) {
        if (typeof result[field] === 'string') {
            try { result[field] = JSON.parse(result[field]); } catch { /* leave as string */ }
        }
    }
    return result;
}

export function getAllRows(collection: string): any[] {
    const db = getDb();
    try {
        const rows = db.prepare(`SELECT * FROM ${collection} ORDER BY rowid DESC`).all() as any[];
        return rows.map(r => deserializeRow(collection, r));
    } catch {
        return [];
    }
}
