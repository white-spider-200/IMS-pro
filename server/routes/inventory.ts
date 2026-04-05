import { Router } from 'express';
import { getDb, getAllRows } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcast, broadcastCollection } from '../sse.js';

const router = Router();
const db = () => getDb();

function nowIso() { return new Date().toISOString(); }
function uuid() { return crypto.randomUUID(); }

function normalizeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function assertPositive(n: number, label = 'Quantity') {
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
}
function assertMoney(n: number, label: string) {
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater`);
}

function getBalance(variantId: string, warehouseId: string) {
    return db().prepare(
        `SELECT * FROM inventory_balances WHERE variant_id = ? AND warehouse_id = ?`
    ).get(variantId, warehouseId) as any;
}

function upsertBalance(variantId: string, warehouseId: string, delta: number, timestamp: string) {
    const existing = getBalance(variantId, warehouseId);
    if (existing) {
        const newQty = normalizeNumber(existing.available_quantity) + delta;
        if (newQty < 0) throw new Error('Insufficient stock');
        db().prepare(`
      UPDATE inventory_balances
      SET available_quantity = ?, version = version + 1, last_modified = ?
      WHERE variant_id = ? AND warehouse_id = ?
    `).run(newQty, timestamp, variantId, warehouseId);
        return db().prepare(`SELECT * FROM inventory_balances WHERE variant_id = ? AND warehouse_id = ?`).get(variantId, warehouseId);
    } else {
        if (delta < 0) throw new Error('No inventory balance found');
        const id = uuid();
        db().prepare(`
      INSERT INTO inventory_balances
        (id, variant_id, warehouse_id, available_quantity, reserved_quantity, blocked_quantity, version, last_modified)
      VALUES (?, ?, ?, ?, 0, 0, 1, ?)
    `).run(id, variantId, warehouseId, delta, timestamp);
        return db().prepare(`SELECT * FROM inventory_balances WHERE id = ?`).get(id);
    }
}

function ensureIdempotency(key: string) {
    const existing = db().prepare(`SELECT id FROM stock_movements WHERE idempotency_key = ?`).get(key)
        || db().prepare(`SELECT id FROM inventory_update_records WHERE idempotency_key = ?`).get(key);
    if (existing) throw new Error('This inventory operation has already been processed');
}

function getAvgCost(variantId: string, timestamp: string): number {
    const invoices = db().prepare(
        `SELECT quantity_purchased, requested_quantity, unit_cost, status, created_at
     FROM purchase_invoices WHERE product_variant_id = ?`
    ).all(variantId) as any[];

    let totalQty = 0, totalCost = 0;
    for (const inv of invoices) {
        if (inv.status === 'cancelled') continue;
        if (new Date(inv.created_at).getTime() > new Date(timestamp).getTime()) continue;
        const qty = normalizeNumber(inv.quantity_purchased ?? inv.requested_quantity);
        const cost = normalizeNumber(inv.unit_cost);
        if (qty <= 0 || cost < 0) continue;
        totalQty += qty;
        totalCost += qty * cost;
    }
    return totalQty > 0 ? totalCost / totalQty : 0;
}

// POST /api/inventory/receive
router.post('/receive', requireAuth, (req, res) => {
    try {
        const { variantId, warehouseId, quantity, batchId, idempotencyKey } = req.body;
        assertPositive(quantity, 'Quantity');
        ensureIdempotency(idempotencyKey);
        const ts = nowIso();
        db().transaction(() => {
            upsertBalance(variantId, warehouseId, quantity, ts);
            const mvId = uuid();
            db().prepare(`
        INSERT INTO stock_movements
          (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, batch_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'receipt', ?, ?, ?, ?, 'completed', ?)
      `).run(mvId, variantId, warehouseId, quantity, idempotencyKey, batchId, `Stock received for batch ${batchId}`, ts);
        })();
        broadcast('inventory_balances', 'updated', getBalance(variantId, warehouseId));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/inventory/issue (sell)
router.post('/issue', requireAuth, (req, res) => {
    try {
        const {
            variantId, warehouseId, quantity, customerName, idempotencyKey,
            unitPrice = 0, clientId, vatRate = 0, deliveryFee = 0, deliveryStatus,
            deliveryAddress, paymentAmount = 0, paymentNotes, notes, transactionTime,
        } = req.body;

        assertPositive(quantity, 'Quantity');
        ensureIdempotency(idempotencyKey);

        const unitPriceN = normalizeNumber(unitPrice);
        const vatRateN = normalizeNumber(vatRate);
        const deliveryFeeN = normalizeNumber(deliveryFee);
        const paymentAmountN = normalizeNumber(paymentAmount);
        assertMoney(unitPriceN, 'Sell price');
        if (vatRateN > 100) throw new Error('VAT cannot exceed 100%');
        assertMoney(deliveryFeeN, 'Delivery fee');

        const ts = transactionTime || nowIso();
        const subtotal = quantity * unitPriceN;
        const vatAmount = subtotal * (vatRateN / 100);
        const total = subtotal + vatAmount + deliveryFeeN;
        assertMoney(paymentAmountN, 'Payment amount');
        if (paymentAmountN > total) throw new Error('Payment amount cannot exceed total amount');

        const costPerUnit = getAvgCost(variantId, ts);
        const cogsAmount = quantity * costPerUnit;
        const grossProfit = subtotal - cogsAmount;
        const paidAmount = Math.min(paymentAmountN, total);
        const invoiceStatus = paidAmount <= 0 ? 'pending' : paidAmount >= total ? 'paid' : 'partial';
        const invoiceNumber = `INV-${Date.now()}`;
        const receiptNumber = paidAmount > 0 ? `PAY-${Date.now()}` : null;

        db().transaction(() => {
            const balance = getBalance(variantId, warehouseId);
            if (!balance) throw new Error('No inventory balance found');
            if (normalizeNumber(balance.available_quantity) < quantity) throw new Error('Insufficient available stock');
            upsertBalance(variantId, warehouseId, -quantity, ts);

            const mvId = uuid();
            db().prepare(`
        INSERT INTO stock_movements
          (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, customer_name, client_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'issue', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(mvId, variantId, warehouseId, quantity, idempotencyKey, customerName, clientId ?? null, notes || `Issued stock to ${customerName}`, ts);

            const invId = uuid();
            const items = JSON.stringify([{ variant_id: variantId, quantity, unit_price: unitPriceN, total: subtotal }]);
            db().prepare(`
        INSERT INTO revenue_invoices
          (id, invoice_number, customer_name, client_id, items, total_amount, subtotal, vat_rate, vat_amount,
           delivery_fee, delivery_status, delivery_address, cost_per_unit_at_sale, cogs_amount, gross_profit,
           status, paid_amount, paid_at, warehouse_id, movement_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, invoiceNumber, customerName, clientId ?? null, items, total, subtotal, vatRateN, vatAmount,
                deliveryFeeN, deliveryStatus || 'pending', deliveryAddress || '', costPerUnit, cogsAmount, grossProfit,
                invoiceStatus, paidAmount, invoiceStatus === 'paid' ? ts : null, warehouseId, mvId, ts);

            const tfrId = uuid();
            db().prepare(`
        INSERT INTO transfers
          (id, transfer_number, transfer_type, client_id, customer_name, warehouse_id, product_variant_id, quantity,
           subtotal, vat_rate, vat_amount, cost_per_unit_at_sale, cogs_amount, gross_profit, total_amount,
           status, movement_id, revenue_invoice_id, created_at)
        VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
      `).run(tfrId, `TRF-${Date.now()}`, clientId ?? null, customerName, warehouseId, variantId, quantity,
                subtotal, vatRateN, vatAmount, costPerUnit, cogsAmount, grossProfit, total, mvId, invId, ts);

            if (paidAmount > 0 && receiptNumber) {
                const payId = uuid();
                db().prepare(`
          INSERT INTO client_payments
            (id, client_id, client_name, direction, scope, invoice_id, invoice_number, receipt_number, amount, notes, warehouse_id, created_at)
          VALUES (?, ?, ?, 'incoming', 'sale', ?, ?, ?, ?, ?, ?, ?)
        `).run(payId, clientId ?? null, customerName, invId, invoiceNumber, receiptNumber, paidAmount,
                    paymentNotes || notes || `Payment recorded with invoice ${invoiceNumber}`, warehouseId, ts);
            }

            if (clientId) {
                const client = db().prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any;
                if (client) {
                    db().prepare(`
            UPDATE clients SET
              total_billed = total_billed + ?,
              paid_amount = paid_amount + ?,
              pending_amount = pending_amount + ?,
              balance_due = balance_due + ?,
              balance = balance + ?,
              last_modified = ?
            WHERE id = ?
          `).run(total, paidAmount, total - paidAmount, total - paidAmount, total - paidAmount, ts, clientId);
                }
            }
        })();

        broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
        broadcastCollection('revenue_invoices', getAllRows('revenue_invoices'));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        broadcastCollection('transfers', getAllRows('transfers'));
        broadcastCollection('client_payments', getAllRows('client_payments'));
        broadcastCollection('clients', getAllRows('clients'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/inventory/transfer
router.post('/transfer', requireAuth, (req, res) => {
    try {
        const { variantId, fromWarehouseId, toWarehouseId, quantity, idempotencyKey } = req.body;
        assertPositive(quantity, 'Quantity');
        if (fromWarehouseId === toWarehouseId) throw new Error('Source and destination must be different');
        ensureIdempotency(idempotencyKey);
        const ts = nowIso();

        db().transaction(() => {
            const src = getBalance(variantId, fromWarehouseId);
            if (!src) throw new Error('No source balance found');
            if (normalizeNumber(src.available_quantity) < quantity) throw new Error('Insufficient source stock');
            upsertBalance(variantId, fromWarehouseId, -quantity, ts);
            upsertBalance(variantId, toWarehouseId, quantity, ts);

            const mvOutId = uuid(); const mvInId = uuid();
            db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, related_movement_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'transfer_out', ?, ?, ?, ?, 'completed', ?)
      `).run(mvOutId, variantId, fromWarehouseId, quantity, `${idempotencyKey}_out`, mvInId, `Transferred to ${toWarehouseId}`, ts);
            db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, related_movement_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'transfer_in', ?, ?, ?, ?, 'completed', ?)
      `).run(mvInId, variantId, toWarehouseId, quantity, `${idempotencyKey}_in`, mvOutId, `Transferred from ${fromWarehouseId}`, ts);

            const tiId = uuid();
            db().prepare(`INSERT INTO transfer_invoices (id, invoice_number, variant_id, quantity, from_warehouse_id, to_warehouse_id, movement_out_id, movement_in_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tiId, `TR-${Date.now()}`, variantId, quantity, fromWarehouseId, toWarehouseId, mvOutId, mvInId, ts);

            const tfrId = uuid();
            db().prepare(`INSERT INTO transfers (id, transfer_number, transfer_type, from_warehouse_id, to_warehouse_id, product_variant_id, quantity, status, movement_out_id, movement_in_id, transfer_invoice_id, created_at)
        VALUES (?, ?, 'warehouse_transfer', ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).run(tfrId, `TRF-${Date.now()}`, fromWarehouseId, toWarehouseId, variantId, quantity, mvOutId, mvInId, tiId, ts);
        })();

        broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        broadcastCollection('transfers', getAllRows('transfers'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/inventory/buy-order
router.post('/buy-order', requireAuth, (req, res) => {
    try {
        const {
            variantId, productId, clientId, clientName, requestedQuantity, warehouseAllocations,
            supplierId, supplierQuantity, receivingWarehouseId, unitCost, vatRate, idempotencyKey
        } = req.body;

        assertPositive(requestedQuantity, 'Quantity');
        ensureIdempotency(idempotencyKey);

        const allocations = (warehouseAllocations || [])
            .map((a: any) => ({ warehouseId: a.warehouseId, quantity: normalizeNumber(a.quantity) }))
            .filter((a: any) => a.warehouseId && a.quantity > 0);

        const totalFromWH = allocations.reduce((s: number, a: any) => s + a.quantity, 0);
        const supplierQty = normalizeNumber(supplierQuantity);
        const uCost = normalizeNumber(unitCost);
        const vRate = normalizeNumber(vatRate);

        if (totalFromWH + supplierQty !== requestedQuantity) throw new Error('Supplier quantity must match remaining required quantity');
        if (!supplierId) throw new Error('Supplier is required');
        if (supplierQty > 0) {
            if (!receivingWarehouseId) throw new Error('Receiving warehouse required for supplier delivery');
            if (uCost <= 0) throw new Error('Unit cost must be greater than zero');
        }

        const subtotal = supplierQty * uCost;
        const vatAmount = subtotal * (vRate / 100);
        const totalCost = subtotal + vatAmount;
        const ts = nowIso();

        db().transaction(() => {
            // Validate all allocations
            for (const alloc of allocations) {
                const bal = getBalance(variantId, alloc.warehouseId);
                if (!bal || normalizeNumber(bal.available_quantity) < alloc.quantity) {
                    throw new Error(`Insufficient stock in warehouse ${alloc.warehouseId}`);
                }
            }
            // Apply allocation debits
            for (const alloc of allocations) {
                upsertBalance(variantId, alloc.warehouseId, -alloc.quantity, ts);
                const mvId = uuid();
                db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, customer_name, client_id, notes, status, transaction_id, timestamp)
          VALUES (?, ?, ?, 'issue', ?, ?, ?, ?, ?, 'completed', ?, ?)
        `).run(mvId, variantId, alloc.warehouseId, alloc.quantity, `${idempotencyKey}_issue_${alloc.warehouseId}`, clientName, clientId, 'Allocated from warehouse for buy flow', idempotencyKey, ts);
            }
            // Apply supplier receipt
            let receiptMvId: string | null = null;
            if (supplierQty > 0 && receivingWarehouseId) {
                upsertBalance(variantId, receivingWarehouseId, supplierQty, ts);
                receiptMvId = uuid();
                db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, source_reference, notes, status, transaction_id, timestamp)
          VALUES (?, ?, ?, 'receipt', ?, ?, ?, ?, 'completed', ?, ?)
        `).run(receiptMvId, variantId, receivingWarehouseId, supplierQty, `${idempotencyKey}_receipt`, supplierId, 'Supplier delivery for buy flow', idempotencyKey, ts);
            }

            const piId = uuid();
            db().prepare(`INSERT INTO purchase_invoices
        (id, invoice_number, supplier_id, product_id, product_variant_id, client_id, requested_quantity,
         quantity_purchased, quantity_from_warehouse, warehouse_allocations, receiving_warehouse_id,
         unit_cost, vat_rate, subtotal, vat_amount, total_cost, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(piId, `PO-${Date.now()}`, supplierId, productId, variantId, clientId, requestedQuantity,
                supplierQty, totalFromWH, JSON.stringify(allocations), receivingWarehouseId ?? null,
                supplierQty > 0 ? uCost : 0, supplierQty > 0 ? vRate : 0, subtotal, vatAmount, totalCost,
                supplierQty > 0 ? 'received' : 'not_required', ts);

            const tfrId = uuid();
            db().prepare(`INSERT INTO transfers
        (id, transfer_number, transfer_type, client_id, customer_name, supplier_id, warehouse_id,
         product_id, product_variant_id, quantity, subtotal, vat_rate, vat_amount, total_amount,
         status, purchase_invoice_id, created_at)
        VALUES (?, ?, 'buy_order', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
      `).run(tfrId, `TRF-${Date.now()}`, clientId, clientName, supplierId ?? null,
                receivingWarehouseId ?? allocations[0]?.warehouseId ?? null, productId, variantId,
                requestedQuantity, subtotal, supplierQty > 0 ? vRate : 0, supplierQty > 0 ? vatAmount : 0,
                totalCost, piId, ts);

            const iuId = uuid();
            db().prepare(`INSERT INTO inventory_update_records
        (id, idempotency_key, client_id, client_name, product_id, variant_id, requested_quantity,
         quantity_from_warehouse, supplier_quantity, warehouse_allocations, receiving_warehouse_id,
         purchase_invoice_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `).run(iuId, idempotencyKey, clientId, clientName, productId, variantId, requestedQuantity,
                totalFromWH, supplierQty, JSON.stringify(allocations), receivingWarehouseId ?? null, piId, ts);

            if (supplierId) {
                const sprId = uuid();
                db().prepare(`INSERT INTO supplier_product_relations
          (id, supplier_id, product_id, variant_id, client_id, purchase_invoice_id, quantity, unit_cost, vat_rate, total_cost, warehouse_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sprId, supplierId, productId, variantId, clientId, piId, supplierQty, uCost, vRate, totalCost, receivingWarehouseId ?? null, ts);
            }
        })();

        broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        broadcastCollection('purchase_invoices', getAllRows('purchase_invoices'));
        broadcastCollection('transfers', getAllRows('transfers'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/inventory/buy-from-customer
router.post('/buy-from-customer', requireAuth, (req, res) => {
    try {
        const {
            variantId, productId, clientId, clientName, warehouseId, quantity, unitCost,
            deliveryStatus, deliveryAddress, deliveryFee = 0, vatRate = 0, paymentAmount = 0, paymentNotes, notes, idempotencyKey, transactionTime
        } = req.body;

        assertPositive(quantity, 'Quantity');
        if (!clientId) throw new Error('Customer is required');
        if (!warehouseId) throw new Error('Warehouse is required');
        const uCost = normalizeNumber(unitCost);
        const dFee = normalizeNumber(deliveryFee);
        const vRate = normalizeNumber(vatRate);
        const pAmt = normalizeNumber(paymentAmount);
        if (uCost < 0) throw new Error('Buy price must be zero or greater');
        ensureIdempotency(idempotencyKey);
        const ts = transactionTime || nowIso();
        const subtotal = quantity * uCost;
        const vatAmount = subtotal * (vRate / 100);
        const total = subtotal + vatAmount + dFee;
        const paidAmount = Math.min(pAmt, total);
        const invoiceStatus = paidAmount <= 0 ? 'pending' : paidAmount >= total ? 'paid' : 'partial';
        const invoiceNumber = `BUY-${Date.now()}`;

        db().transaction(() => {
            upsertBalance(variantId, warehouseId, quantity, ts);
            const mvId = uuid();
            db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, customer_name, client_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'receipt', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(mvId, variantId, warehouseId, quantity, idempotencyKey, clientName, clientId, notes || `Purchased from customer ${clientName}`, ts);

            const piId = uuid();
            const items = JSON.stringify([{ variant_id: variantId, quantity, unit_price: uCost, total: subtotal }]);
            db().prepare(`INSERT INTO purchase_invoices
        (id, invoice_number, supplier_name, product_id, product_variant_id, client_id, requested_quantity,
         quantity_purchased, unit_cost, vat_rate, subtotal, vat_amount, total_cost, total_amount, paid_amount, items, status, invoice_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'buy_from_customer', ?)
      `).run(piId, invoiceNumber, clientName, productId, variantId, clientId, quantity,
                quantity, uCost, vRate, subtotal, vatAmount, total, total, paidAmount, items, invoiceStatus, ts);

            db().prepare(`INSERT INTO transfers (id, transfer_number, transfer_type, client_id, customer_name, warehouse_id, product_variant_id, quantity, subtotal, vat_rate, vat_amount, total_amount, status, purchase_invoice_id, created_at)
        VALUES (?, ?, 'buy_from_customer', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
      `).run(uuid(), `TRF-${Date.now()}`, clientId, clientName, warehouseId, variantId, quantity, subtotal, vRate, vatAmount, total, piId, ts);

            if (paidAmount > 0) {
                db().prepare(`INSERT INTO client_payments (id, client_id, client_name, direction, scope, invoice_id, invoice_number, receipt_number, amount, notes, warehouse_id, created_at)
          VALUES (?, ?, ?, 'outgoing', 'purchase', ?, ?, ?, ?, ?, ?, ?)
        `).run(uuid(), clientId, clientName, piId, invoiceNumber, `RCP-${Date.now()}`, paidAmount, paymentNotes || notes || '', warehouseId, ts);
            }
        })();

        broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        broadcastCollection('purchase_invoices', getAllRows('purchase_invoices'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/inventory/return
router.post('/return', requireAuth, (req, res) => {
    try {
        const {
            variantId, productId, clientId, clientName, warehouseId, quantity, unitAmount,
            returnScope, notes, idempotencyKey, transactionTime, originalInvoiceId
        } = req.body;

        assertPositive(quantity, 'Quantity');
        ensureIdempotency(idempotencyKey);
        const ts = transactionTime || nowIso();
        const total = quantity * normalizeNumber(unitAmount);
        const isSaleReturn = returnScope === 'sale';

        db().transaction(() => {
            // sale return → stock comes back; purchase return → stock goes out
            upsertBalance(variantId, warehouseId, isSaleReturn ? quantity : -quantity, ts);

            const mvId = uuid();
            db().prepare(`INSERT INTO stock_movements (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, customer_name, client_id, notes, status, timestamp)
        VALUES (?, ?, ?, 'return', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(mvId, variantId, warehouseId, quantity, idempotencyKey, clientName, clientId, notes || `Return from ${clientName}`, ts);

            const riId = uuid();
            db().prepare(`INSERT INTO return_invoices (id, invoice_number, client_id, client_name, variant_id, product_id, warehouse_id, quantity, unit_amount, total_amount, return_scope, notes, original_invoice_id, movement_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(riId, `RET-${Date.now()}`, clientId, clientName, variantId, productId, warehouseId, quantity, normalizeNumber(unitAmount), total, returnScope, notes || null, originalInvoiceId || null, mvId, ts);
        })();

        broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
        broadcastCollection('stock_movements', getAllRows('stock_movements'));
        broadcastCollection('return_invoices', getAllRows('return_invoices'));
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
