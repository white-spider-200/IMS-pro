import { Router } from "express";
import type { DbTx } from "../../db.js";
import { getAllRows, withTransaction } from "../../db.js";
import { prisma } from "../../prisma.js";
import { requireAuth } from "../../auth.js";
import { broadcast, broadcastCollection } from "../../sse.js";

const router = Router();

function nowIso() { return new Date().toISOString(); }
function uuid() { return crypto.randomUUID(); }
function db(tx?: DbTx) { return tx ?? prisma; }

function normalizeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function assertPositive(n: number, label = "Quantity") {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
}
function assertMoney(n: number, label: string) {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater`);
}

async function getBalance(variantId: string, warehouseId: string, tx?: DbTx) {
  return db(tx).inventory_balances.findUnique({
    where: { variant_id_warehouse_id: { variant_id: variantId, warehouse_id: warehouseId } },
  });
}

async function upsertBalance(variantId: string, warehouseId: string, delta: number, timestamp: string, tx: DbTx) {
  const existing = await getBalance(variantId, warehouseId, tx);
  if (existing) {
    const newQty = normalizeNumber(existing.available_quantity) + delta;
    if (newQty < 0) throw new Error("Insufficient stock");
    return db(tx).inventory_balances.update({
      where: { variant_id_warehouse_id: { variant_id: variantId, warehouse_id: warehouseId } },
      data: {
        available_quantity: newQty,
        version: { increment: 1 },
        last_modified: timestamp,
      },
    });
  }

  if (delta < 0) throw new Error("No inventory balance found");
  return db(tx).inventory_balances.create({
    data: {
      id: uuid(),
      variant_id: variantId,
      warehouse_id: warehouseId,
      available_quantity: delta,
      reserved_quantity: 0,
      blocked_quantity: 0,
      version: 1,
      last_modified: timestamp,
    },
  });
}

async function ensureIdempotency(key: string, tx?: DbTx) {
  const existingMovement = await db(tx).stock_movements.findUnique({ where: { idempotency_key: key } });
  if (existingMovement) throw new Error("This inventory operation has already been processed");
  const existingRecord = await db(tx).inventory_update_records.findUnique({ where: { idempotency_key: key } });
  if (existingRecord) throw new Error("This inventory operation has already been processed");
}

async function getAvgCost(variantId: string, timestamp: string, tx?: DbTx): Promise<number> {
  const invoices = await db(tx).purchase_invoices.findMany({
    where: { product_variant_id: variantId },
    select: { quantity_purchased: true, requested_quantity: true, unit_cost: true, status: true, created_at: true },
  });

  let totalQty = 0;
  let totalCost = 0;
  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    if (new Date(inv.created_at).getTime() > new Date(timestamp).getTime()) continue;
    const qty = normalizeNumber(inv.quantity_purchased ?? inv.requested_quantity);
    const cost = normalizeNumber(inv.unit_cost);
    if (qty <= 0 || cost < 0) continue;
    totalQty += qty;
    totalCost += qty * cost;
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

router.post("/receive", requireAuth, async (req, res) => {
  try {
    const { variantId, warehouseId, quantity, batchId, idempotencyKey } = req.body;
    assertPositive(quantity, "Quantity");
    const ts = nowIso();

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      await upsertBalance(variantId, warehouseId, quantity, ts, tx);
      await db(tx).stock_movements.create({
        data: {
          id: uuid(),
          variant_id: variantId,
          warehouse_id: warehouseId,
          movement_type: "receipt",
          quantity,
          idempotency_key: idempotencyKey,
          batch_id: batchId ?? null,
          notes: `Stock received for batch ${batchId}`,
          status: "completed",
          timestamp: ts,
        },
      });
    });

    broadcast("inventory_balances", "updated", await getBalance(variantId, warehouseId));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/issue", requireAuth, async (req, res) => {
  try {
    const {
      variantId, warehouseId, quantity, customerName, idempotencyKey,
      unitPrice = 0, clientId, vatRate = 0, deliveryFee = 0, deliveryStatus,
      deliveryAddress, paymentAmount = 0, paymentNotes, notes, transactionTime,
    } = req.body;

    assertPositive(quantity, "Quantity");
    const unitPriceN = normalizeNumber(unitPrice);
    const vatRateN = normalizeNumber(vatRate);
    const deliveryFeeN = normalizeNumber(deliveryFee);
    const paymentAmountN = normalizeNumber(paymentAmount);
    assertMoney(unitPriceN, "Sell price");
    if (vatRateN > 100) throw new Error("VAT cannot exceed 100%");
    assertMoney(deliveryFeeN, "Delivery fee");

    const ts = transactionTime || nowIso();
    const subtotal = quantity * unitPriceN;
    const vatAmount = subtotal * (vatRateN / 100);
    const total = subtotal + vatAmount + deliveryFeeN;
    assertMoney(paymentAmountN, "Payment amount");
    if (paymentAmountN > total) throw new Error("Payment amount cannot exceed total amount");

    const costPerUnit = await getAvgCost(variantId, ts);
    const cogsAmount = quantity * costPerUnit;
    const grossProfit = subtotal - cogsAmount;
    const paidAmount = Math.min(paymentAmountN, total);
    const invoiceStatus = paidAmount <= 0 ? "pending" : paidAmount >= total ? "paid" : "partial";
    const invoiceNumber = `INV-${Date.now()}`;
    const receiptNumber = paidAmount > 0 ? `PAY-${Date.now()}` : null;

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      const balance = await getBalance(variantId, warehouseId, tx);
      if (!balance) throw new Error("No inventory balance found");
      if (normalizeNumber(balance.available_quantity) < quantity) throw new Error("Insufficient available stock");
      await upsertBalance(variantId, warehouseId, -quantity, ts, tx);

      const mvId = uuid();
      await db(tx).stock_movements.create({
        data: {
          id: mvId,
          variant_id: variantId,
          warehouse_id: warehouseId,
          movement_type: "issue",
          quantity,
          idempotency_key: idempotencyKey,
          customer_name: customerName,
          client_id: clientId ?? null,
          notes: notes || `Issued stock to ${customerName}`,
          status: "completed",
          timestamp: ts,
        },
      });

      const invId = uuid();
      const items = JSON.stringify([{ variant_id: variantId, quantity, unit_price: unitPriceN, total: subtotal }]);
      await db(tx).revenue_invoices.create({
        data: {
          id: invId,
          invoice_number: invoiceNumber,
          customer_name: customerName,
          client_id: clientId ?? null,
          items,
          total_amount: total,
          subtotal,
          vat_rate: vatRateN,
          vat_amount: vatAmount,
          delivery_fee: deliveryFeeN,
          delivery_status: deliveryStatus || "pending",
          delivery_address: deliveryAddress || "",
          cost_per_unit_at_sale: costPerUnit,
          cogs_amount: cogsAmount,
          gross_profit: grossProfit,
          status: invoiceStatus,
          paid_amount: paidAmount,
          paid_at: invoiceStatus === "paid" ? ts : null,
          warehouse_id: warehouseId,
          movement_id: mvId,
          created_at: ts,
        },
      });

      await db(tx).transfers.create({
        data: {
          id: uuid(),
          transfer_number: `TRF-${Date.now()}`,
          transfer_type: "sell",
          client_id: clientId ?? null,
          customer_name: customerName,
          warehouse_id: warehouseId,
          product_variant_id: variantId,
          quantity,
          subtotal,
          vat_rate: vatRateN,
          vat_amount: vatAmount,
          cost_per_unit_at_sale: costPerUnit,
          cogs_amount: cogsAmount,
          gross_profit: grossProfit,
          total_amount: total,
          status: "completed",
          movement_id: mvId,
          revenue_invoice_id: invId,
          created_at: ts,
        },
      });

      if (paidAmount > 0 && receiptNumber) {
        await db(tx).client_payments.create({
          data: {
            id: uuid(),
            client_id: clientId ?? null,
            client_name: customerName,
            direction: "incoming",
            scope: "sale",
            invoice_id: invId,
            invoice_number: invoiceNumber,
            receipt_number: receiptNumber,
            amount: paidAmount,
            notes: paymentNotes || notes || `Payment recorded with invoice ${invoiceNumber}`,
            warehouse_id: warehouseId,
            created_at: ts,
          },
        });
      }

      if (clientId) {
        const client = await db(tx).clients.findUnique({ where: { id: clientId } });
        if (client) {
          await db(tx).clients.update({
            where: { id: clientId },
            data: {
              total_billed: normalizeNumber(client.total_billed) + total,
              paid_amount: normalizeNumber(client.paid_amount) + paidAmount,
              pending_amount: normalizeNumber(client.pending_amount) + (total - paidAmount),
              balance_due: normalizeNumber(client.balance_due) + (total - paidAmount),
              balance: normalizeNumber(client.balance) + (total - paidAmount),
              last_modified: ts,
            },
          });
        }
      }
    });

    broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
    broadcastCollection("revenue_invoices", await getAllRows("revenue_invoices"));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    broadcastCollection("transfers", await getAllRows("transfers"));
    broadcastCollection("client_payments", await getAllRows("client_payments"));
    broadcastCollection("clients", await getAllRows("clients"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/transfer", requireAuth, async (req, res) => {
  try {
    const { variantId, fromWarehouseId, toWarehouseId, quantity, idempotencyKey } = req.body;
    assertPositive(quantity, "Quantity");
    if (fromWarehouseId === toWarehouseId) throw new Error("Source and destination must be different");
    const ts = nowIso();

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      const src = await getBalance(variantId, fromWarehouseId, tx);
      if (!src) throw new Error("No source balance found");
      if (normalizeNumber(src.available_quantity) < quantity) throw new Error("Insufficient source stock");
      await upsertBalance(variantId, fromWarehouseId, -quantity, ts, tx);
      await upsertBalance(variantId, toWarehouseId, quantity, ts, tx);

      const mvOutId = uuid();
      const mvInId = uuid();
      await db(tx).stock_movements.create({
        data: {
          id: mvOutId,
          variant_id: variantId,
          warehouse_id: fromWarehouseId,
          movement_type: "transfer_out",
          quantity,
          idempotency_key: `${idempotencyKey}_out`,
          related_movement_id: mvInId,
          notes: `Transferred to ${toWarehouseId}`,
          status: "completed",
          timestamp: ts,
        },
      });
      await db(tx).stock_movements.create({
        data: {
          id: mvInId,
          variant_id: variantId,
          warehouse_id: toWarehouseId,
          movement_type: "transfer_in",
          quantity,
          idempotency_key: `${idempotencyKey}_in`,
          related_movement_id: mvOutId,
          notes: `Transferred from ${fromWarehouseId}`,
          status: "completed",
          timestamp: ts,
        },
      });

      const tiId = uuid();
      await db(tx).transfer_invoices.create({
        data: {
          id: tiId,
          invoice_number: `TR-${Date.now()}`,
          variant_id: variantId,
          quantity,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          movement_out_id: mvOutId,
          movement_in_id: mvInId,
          created_at: ts,
        },
      });

      await db(tx).transfers.create({
        data: {
          id: uuid(),
          transfer_number: `TRF-${Date.now()}`,
          transfer_type: "warehouse_transfer",
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          product_variant_id: variantId,
          quantity,
          status: "completed",
          movement_out_id: mvOutId,
          movement_in_id: mvInId,
          transfer_invoice_id: tiId,
          created_at: ts,
        },
      });
    });

    broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    broadcastCollection("transfers", await getAllRows("transfers"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/buy-order", requireAuth, async (req, res) => {
  try {
    const {
      variantId, productId, clientId, clientName, requestedQuantity, warehouseAllocations,
      supplierId, supplierQuantity, receivingWarehouseId, unitCost, vatRate, idempotencyKey,
    } = req.body;

    assertPositive(requestedQuantity, "Quantity");
    const allocations = (warehouseAllocations || [])
      .map((a: any) => ({ warehouseId: a.warehouseId, quantity: normalizeNumber(a.quantity) }))
      .filter((a: any) => a.warehouseId && a.quantity > 0);

    const totalFromWH = allocations.reduce((s: number, a: any) => s + a.quantity, 0);
    const supplierQty = normalizeNumber(supplierQuantity);
    const uCost = normalizeNumber(unitCost);
    const vRate = normalizeNumber(vatRate);

    if (totalFromWH + supplierQty !== requestedQuantity) throw new Error("Supplier quantity must match remaining required quantity");
    if (!supplierId) throw new Error("Supplier is required");
    if (supplierQty > 0) {
      if (!receivingWarehouseId) throw new Error("Receiving warehouse required for supplier delivery");
      if (uCost <= 0) throw new Error("Unit cost must be greater than zero");
    }

    const subtotal = supplierQty * uCost;
    const vatAmount = subtotal * (vRate / 100);
    const totalCost = subtotal + vatAmount;
    const ts = nowIso();

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      for (const alloc of allocations) {
        const bal = await getBalance(variantId, alloc.warehouseId, tx);
        if (!bal || normalizeNumber(bal.available_quantity) < alloc.quantity) {
          throw new Error(`Insufficient stock in warehouse ${alloc.warehouseId}`);
        }
      }

      for (const alloc of allocations) {
        await upsertBalance(variantId, alloc.warehouseId, -alloc.quantity, ts, tx);
        await db(tx).stock_movements.create({
          data: {
            id: uuid(),
            variant_id: variantId,
            warehouse_id: alloc.warehouseId,
            movement_type: "issue",
            quantity: alloc.quantity,
            idempotency_key: `${idempotencyKey}_issue_${alloc.warehouseId}`,
            customer_name: clientName,
            client_id: clientId,
            notes: "Allocated from warehouse for buy flow",
            status: "completed",
            transaction_id: idempotencyKey,
            timestamp: ts,
          },
        });
      }

      if (supplierQty > 0 && receivingWarehouseId) {
        await upsertBalance(variantId, receivingWarehouseId, supplierQty, ts, tx);
        await db(tx).stock_movements.create({
          data: {
            id: uuid(),
            variant_id: variantId,
            warehouse_id: receivingWarehouseId,
            movement_type: "receipt",
            quantity: supplierQty,
            idempotency_key: `${idempotencyKey}_receipt`,
            source_reference: supplierId,
            notes: "Supplier delivery for buy flow",
            status: "completed",
            transaction_id: idempotencyKey,
            timestamp: ts,
          },
        });
      }

      const piId = uuid();
      await db(tx).purchase_invoices.create({
        data: {
          id: piId,
          invoice_number: `PO-${Date.now()}`,
          supplier_id: supplierId,
          product_id: productId,
          product_variant_id: variantId,
          client_id: clientId,
          requested_quantity: requestedQuantity,
          quantity_purchased: supplierQty,
          quantity_from_warehouse: totalFromWH,
          warehouse_allocations: JSON.stringify(allocations),
          receiving_warehouse_id: receivingWarehouseId ?? null,
          unit_cost: supplierQty > 0 ? uCost : 0,
          vat_rate: supplierQty > 0 ? vRate : 0,
          subtotal,
          vat_amount: vatAmount,
          total_cost: totalCost,
          status: supplierQty > 0 ? "received" : "not_required",
          created_at: ts,
        },
      });

      await db(tx).transfers.create({
        data: {
          id: uuid(),
          transfer_number: `TRF-${Date.now()}`,
          transfer_type: "buy_order",
          client_id: clientId,
          customer_name: clientName,
          supplier_id: supplierId ?? null,
          warehouse_id: receivingWarehouseId ?? allocations[0]?.warehouseId ?? null,
          product_id: productId,
          product_variant_id: variantId,
          quantity: requestedQuantity,
          subtotal,
          vat_rate: supplierQty > 0 ? vRate : 0,
          vat_amount: supplierQty > 0 ? vatAmount : 0,
          total_amount: totalCost,
          status: "completed",
          purchase_invoice_id: piId,
          created_at: ts,
        },
      });

      await db(tx).inventory_update_records.create({
        data: {
          id: uuid(),
          idempotency_key: idempotencyKey,
          client_id: clientId,
          client_name: clientName,
          product_id: productId,
          variant_id: variantId,
          requested_quantity: requestedQuantity,
          quantity_from_warehouse: totalFromWH,
          supplier_quantity: supplierQty,
          warehouse_allocations: JSON.stringify(allocations),
          receiving_warehouse_id: receivingWarehouseId ?? null,
          purchase_invoice_id: piId,
          status: "completed",
          created_at: ts,
        },
      });

      await db(tx).supplier_product_relations.create({
        data: {
          id: uuid(),
          supplier_id: supplierId,
          product_id: productId,
          variant_id: variantId,
          client_id: clientId,
          purchase_invoice_id: piId,
          quantity: supplierQty,
          unit_cost: uCost,
          vat_rate: vRate,
          total_cost: totalCost,
          warehouse_id: receivingWarehouseId ?? null,
          created_at: ts,
        },
      });
    });

    broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    broadcastCollection("purchase_invoices", await getAllRows("purchase_invoices"));
    broadcastCollection("transfers", await getAllRows("transfers"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/buy-from-customer", requireAuth, async (req, res) => {
  try {
    const {
      variantId, productId, clientId, clientName, warehouseId, quantity, unitCost,
      deliveryFee = 0, vatRate = 0, paymentAmount = 0, paymentNotes, notes, idempotencyKey, transactionTime,
    } = req.body;

    assertPositive(quantity, "Quantity");
    if (!clientId) throw new Error("Customer is required");
    if (!warehouseId) throw new Error("Warehouse is required");

    const uCost = normalizeNumber(unitCost);
    const dFee = normalizeNumber(deliveryFee);
    const vRate = normalizeNumber(vatRate);
    const pAmt = normalizeNumber(paymentAmount);
    if (uCost < 0) throw new Error("Buy price must be zero or greater");

    const ts = transactionTime || nowIso();
    const subtotal = quantity * uCost;
    const vatAmount = subtotal * (vRate / 100);
    const total = subtotal + vatAmount + dFee;
    const paidAmount = Math.min(pAmt, total);
    const invoiceStatus = paidAmount <= 0 ? "pending" : paidAmount >= total ? "paid" : "partial";
    const invoiceNumber = `BUY-${Date.now()}`;

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      await upsertBalance(variantId, warehouseId, quantity, ts, tx);
      await db(tx).stock_movements.create({
        data: {
          id: uuid(),
          variant_id: variantId,
          warehouse_id: warehouseId,
          movement_type: "receipt",
          quantity,
          idempotency_key: idempotencyKey,
          customer_name: clientName,
          client_id: clientId,
          notes: notes || `Purchased from customer ${clientName}`,
          status: "completed",
          timestamp: ts,
        },
      });

      const piId = uuid();
      const items = JSON.stringify([{ variant_id: variantId, quantity, unit_price: uCost, total: subtotal }]);
      await db(tx).purchase_invoices.create({
        data: {
          id: piId,
          invoice_number: invoiceNumber,
          supplier_name: clientName,
          product_id: productId,
          product_variant_id: variantId,
          client_id: clientId,
          requested_quantity: quantity,
          quantity_purchased: quantity,
          unit_cost: uCost,
          vat_rate: vRate,
          subtotal,
          vat_amount: vatAmount,
          total_cost: total,
          total_amount: total,
          paid_amount: paidAmount,
          items,
          status: invoiceStatus,
          invoice_type: "buy_from_customer",
          created_at: ts,
        },
      });

      await db(tx).transfers.create({
        data: {
          id: uuid(),
          transfer_number: `TRF-${Date.now()}`,
          transfer_type: "buy_from_customer",
          client_id: clientId,
          customer_name: clientName,
          warehouse_id: warehouseId,
          product_variant_id: variantId,
          quantity,
          subtotal,
          vat_rate: vRate,
          vat_amount: vatAmount,
          total_amount: total,
          status: "completed",
          purchase_invoice_id: piId,
          created_at: ts,
        },
      });

      if (paidAmount > 0) {
        await db(tx).client_payments.create({
          data: {
            id: uuid(),
            client_id: clientId,
            client_name: clientName,
            direction: "outgoing",
            scope: "purchase",
            invoice_id: piId,
            invoice_number: invoiceNumber,
            receipt_number: `RCP-${Date.now()}`,
            amount: paidAmount,
            notes: paymentNotes || notes || "",
            warehouse_id: warehouseId,
            created_at: ts,
          },
        });
      }
    });

    broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    broadcastCollection("purchase_invoices", await getAllRows("purchase_invoices"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/return", requireAuth, async (req, res) => {
  try {
    const {
      variantId, productId, clientId, clientName, warehouseId, quantity, unitAmount,
      returnScope, notes, idempotencyKey, transactionTime, originalInvoiceId,
    } = req.body;

    assertPositive(quantity, "Quantity");
    const ts = transactionTime || nowIso();
    const total = quantity * normalizeNumber(unitAmount);
    const isSaleReturn = returnScope === "sale";

    await withTransaction(async (tx) => {
      await ensureIdempotency(idempotencyKey, tx);
      await upsertBalance(variantId, warehouseId, isSaleReturn ? quantity : -quantity, ts, tx);

      const mvId = uuid();
      await db(tx).stock_movements.create({
        data: {
          id: mvId,
          variant_id: variantId,
          warehouse_id: warehouseId,
          movement_type: "return",
          quantity,
          idempotency_key: idempotencyKey,
          customer_name: clientName,
          client_id: clientId,
          notes: notes || `Return from ${clientName}`,
          status: "completed",
          timestamp: ts,
        },
      });

      await db(tx).return_invoices.create({
        data: {
          id: uuid(),
          invoice_number: `RET-${Date.now()}`,
          client_id: clientId,
          client_name: clientName,
          variant_id: variantId,
          product_id: productId,
          warehouse_id: warehouseId,
          quantity,
          unit_amount: normalizeNumber(unitAmount),
          total_amount: total,
          return_scope: returnScope,
          notes: notes || null,
          original_invoice_id: originalInvoiceId || null,
          movement_id: mvId,
          created_at: ts,
        },
      });
    });

    broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
    broadcastCollection("stock_movements", await getAllRows("stock_movements"));
    broadcastCollection("return_invoices", await getAllRows("return_invoices"));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
