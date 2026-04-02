import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

type BalanceRecord = {
  available_quantity?: number;
  reserved_quantity?: number;
  blocked_quantity?: number;
  version?: number;
};

type IssueStockOptions = {
  unitPrice?: number;
  clientId?: string;
  vatRate?: number;
  deliveryStatus?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  notes?: string;
  transactionTime?: string;
};

type WarehouseAllocationInput = {
  warehouseId: string;
  quantity: number;
};

type ProcessBuyOrderInput = {
  variantId: string;
  productId: string;
  clientId: string;
  clientName: string;
  requestedQuantity: number;
  warehouseAllocations: WarehouseAllocationInput[];
  supplierId?: string | null;
  supplierQuantity: number;
  receivingWarehouseId?: string | null;
  unitCost: number;
  vatRate: number;
  idempotencyKey: string;
};

type BuyFromCustomerInput = {
  variantId: string;
  productId: string;
  clientId: string;
  clientName: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  deliveryStatus?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  notes?: string;
  idempotencyKey: string;
  transactionTime?: string;
};

type ReturnStockInput = {
  variantId: string;
  productId: string;
  clientId: string;
  clientName: string;
  warehouseId: string;
  quantity: number;
  unitAmount: number;
  returnScope: 'sale' | 'purchase';
  notes?: string;
  idempotencyKey: string;
  transactionTime?: string;
  originalInvoiceId?: string | null;
};

const BALANCES_COLLECTION = 'inventory_balances';
const MOVEMENTS_COLLECTION = 'stock_movements';
const REVENUE_INVOICES_COLLECTION = 'revenue_invoices';
const TRANSFER_INVOICES_COLLECTION = 'transfer_invoices';
const PURCHASE_INVOICES_COLLECTION = 'purchase_invoices';
const RETURN_INVOICES_COLLECTION = 'return_invoices';
const TRANSFERS_COLLECTION = 'transfers';
const INVENTORY_UPDATE_RECORDS_COLLECTION = 'inventory_update_records';
const SUPPLIER_PRODUCT_RELATIONS_COLLECTION = 'supplier_product_relations';

const nowIso = () => new Date().toISOString();

const normalizeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const assertPositiveQuantity = (quantity: number) => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
};

async function ensureIdempotencyKeyIsUnused(idempotencyKey: string) {
  const [existingMovement, existingInventoryUpdate] = await Promise.all([
    getDocs(
      query(collection(db, MOVEMENTS_COLLECTION), where('idempotency_key', '==', idempotencyKey))
    ),
    getDocs(
      query(
        collection(db, INVENTORY_UPDATE_RECORDS_COLLECTION),
        where('idempotency_key', '==', idempotencyKey)
      )
    ),
  ]);

  if (!existingMovement.empty || !existingInventoryUpdate.empty) {
    throw new Error('This inventory operation has already been processed');
  }
}

function parseTimestamp(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function getAverageBuyCostForVariantAtTime(variantId: string, timestamp: string) {
  const snapshot = await getDocs(
    query(collection(db, PURCHASE_INVOICES_COLLECTION), where('product_variant_id', '==', variantId))
  );

  const totals = snapshot.docs.reduce(
    (accumulator, documentSnapshot) => {
      const invoice = documentSnapshot.data() ?? {};

      if (invoice.status === 'cancelled') return accumulator;
      if (parseTimestamp(invoice.created_at) > parseTimestamp(timestamp)) return accumulator;

      const quantity = normalizeNumber(invoice.quantity_purchased ?? invoice.requested_quantity);
      const unitCost = normalizeNumber(invoice.unit_cost);

      if (quantity <= 0 || unitCost < 0) return accumulator;

      return {
        quantity: accumulator.quantity + quantity,
        cost: accumulator.cost + (quantity * unitCost),
      };
    },
    { quantity: 0, cost: 0 }
  );

  return totals.quantity > 0 ? totals.cost / totals.quantity : 0;
}

async function getBalanceQuerySnapshot(variantId: string, warehouseId: string) {
  return getDocs(
    query(
      collection(db, BALANCES_COLLECTION),
      where('variant_id', '==', variantId),
      where('warehouse_id', '==', warehouseId)
    )
  );
}

export const InventoryService = {
  async receiveStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    batchId: string,
    idempotencyKey: string
  ) {
    assertPositiveQuantity(quantity);
    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const balanceQuery = await getBalanceQuerySnapshot(variantId, warehouseId);
    const balanceRef = balanceQuery.empty
      ? doc(collection(db, BALANCES_COLLECTION))
      : balanceQuery.docs[0].ref;
    const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const timestamp = nowIso();

    await runTransaction(db, async (transaction) => {
      const balanceSnapshot = await transaction.get(balanceRef);
      const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;

      transaction.set(
        balanceRef,
        {
          variant_id: variantId,
          warehouse_id: warehouseId,
          available_quantity: normalizeNumber(current.available_quantity) + quantity,
          reserved_quantity: normalizeNumber(current.reserved_quantity),
          blocked_quantity: normalizeNumber(current.blocked_quantity),
          version: normalizeNumber(current.version) + 1,
          last_modified: timestamp,
        },
        { merge: true }
      );

      transaction.set(movementRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        movement_type: 'receipt',
        quantity,
        batch_id: batchId,
        idempotency_key: idempotencyKey,
        timestamp,
        notes: `Stock received for batch ${batchId}`,
        status: 'completed',
      });
    });
  },

  async issueStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    customerName: string,
    idempotencyKey: string,
    options: IssueStockOptions = {}
  ) {
    assertPositiveQuantity(quantity);
    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const balanceQuery = await getBalanceQuerySnapshot(variantId, warehouseId);
    if (balanceQuery.empty) {
      throw new Error('No inventory balance found for this variant in the selected warehouse');
    }

    const balanceRef = balanceQuery.docs[0].ref;
    const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const invoiceRef = doc(collection(db, REVENUE_INVOICES_COLLECTION));
    const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
    const clientRef = options.clientId ? doc(db, 'clients', options.clientId) : null;
    const timestamp = nowIso();
    const unitPrice = normalizeNumber(options.unitPrice);
    const vatRate = normalizeNumber(options.vatRate);
    const deliveryFee = normalizeNumber(options.deliveryFee);
    const subtotal = quantity * unitPrice;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount + deliveryFee;
    const costPerUnitAtSale = await getAverageBuyCostForVariantAtTime(variantId, timestamp);
    const cogsAmount = quantity * costPerUnitAtSale;
    const grossProfit = subtotal - cogsAmount;
    const invoiceNumber = `INV-${Date.now()}`;

    await runTransaction(db, async (transaction) => {
      const balanceSnapshot = await transaction.get(balanceRef);
      const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;
      const availableQuantity = normalizeNumber(current.available_quantity);

      if (availableQuantity < quantity) {
        throw new Error('Insufficient available stock for this issue');
      }

      transaction.update(balanceRef, {
        available_quantity: availableQuantity - quantity,
        reserved_quantity: normalizeNumber(current.reserved_quantity),
        blocked_quantity: normalizeNumber(current.blocked_quantity),
        version: normalizeNumber(current.version) + 1,
        last_modified: timestamp,
      });

      transaction.set(movementRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        movement_type: 'issue',
        quantity,
        idempotency_key: idempotencyKey,
        timestamp,
        customer_name: customerName,
        client_id: options.clientId ?? null,
        notes: options.notes || `Issued stock to ${customerName}`,
        status: 'completed',
      });

      transaction.set(invoiceRef, {
        invoice_number: invoiceNumber,
        customer_name: customerName,
        client_id: options.clientId ?? null,
        items: [
          {
            variant_id: variantId,
            quantity,
            unit_price: unitPrice,
            total: subtotal,
          },
        ],
        total_amount: total,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        delivery_fee: deliveryFee,
        delivery_status: options.deliveryStatus || 'pending',
        delivery_address: options.deliveryAddress || '',
        cost_per_unit_at_sale: costPerUnitAtSale,
        cogs_amount: cogsAmount,
        gross_profit: grossProfit,
        status: 'pending',
        paid_amount: 0,
        warehouse_id: warehouseId,
        movement_id: movementRef.id,
        created_at: timestamp,
      });

      transaction.set(transferRef, {
        transfer_number: `TRF-${Date.now()}`,
        transfer_type: 'sell',
        client_id: options.clientId ?? null,
        customer_name: customerName,
        warehouse_id: warehouseId,
        product_variant_id: variantId,
        quantity,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        cost_per_unit_at_sale: costPerUnitAtSale,
        cogs_amount: cogsAmount,
        gross_profit: grossProfit,
        total_amount: total,
        status: 'completed',
        movement_id: movementRef.id,
        revenue_invoice_id: invoiceRef.id,
        created_at: timestamp,
      });

      if (clientRef) {
        const clientSnapshot = await transaction.get(clientRef);
        const clientData = clientSnapshot.data() ?? {};
        transaction.set(clientRef, {
          total_billed: normalizeNumber(clientData.total_billed) + total,
          paid_amount: normalizeNumber(clientData.paid_amount),
          pending_amount: normalizeNumber(clientData.pending_amount) + total,
          balance_due: normalizeNumber(clientData.balance_due) + total,
          credit_balance: normalizeNumber(clientData.credit_balance),
          balance: normalizeNumber(clientData.balance) + total,
          last_modified: timestamp,
        }, { merge: true });
      }
    });
  },

  async transferStock(
    variantId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    idempotencyKey: string
  ) {
    assertPositiveQuantity(quantity);
    if (fromWarehouseId === toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const sourceBalanceQuery = await getBalanceQuerySnapshot(variantId, fromWarehouseId);
    if (sourceBalanceQuery.empty) {
      throw new Error('No source inventory balance found for this variant');
    }

    const destinationBalanceQuery = await getBalanceQuerySnapshot(variantId, toWarehouseId);
    const sourceBalanceRef = sourceBalanceQuery.docs[0].ref;
    const destinationBalanceRef = destinationBalanceQuery.empty
      ? doc(collection(db, BALANCES_COLLECTION))
      : destinationBalanceQuery.docs[0].ref;
    const movementOutRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const movementInRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const invoiceRef = doc(collection(db, TRANSFER_INVOICES_COLLECTION));
    const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
    const timestamp = nowIso();

    await runTransaction(db, async (transaction) => {
      const sourceSnapshot = await transaction.get(sourceBalanceRef);
      const destinationSnapshot = await transaction.get(destinationBalanceRef);
      const source = (sourceSnapshot.data() ?? {}) as BalanceRecord;
      const destination = (destinationSnapshot.data() ?? {}) as BalanceRecord;
      const sourceAvailable = normalizeNumber(source.available_quantity);

      if (sourceAvailable < quantity) {
        throw new Error('Insufficient stock in the source warehouse');
      }

      transaction.update(sourceBalanceRef, {
        available_quantity: sourceAvailable - quantity,
        reserved_quantity: normalizeNumber(source.reserved_quantity),
        blocked_quantity: normalizeNumber(source.blocked_quantity),
        version: normalizeNumber(source.version) + 1,
        last_modified: timestamp,
      });

      transaction.set(
        destinationBalanceRef,
        {
          variant_id: variantId,
          warehouse_id: toWarehouseId,
          available_quantity: normalizeNumber(destination.available_quantity) + quantity,
          reserved_quantity: normalizeNumber(destination.reserved_quantity),
          blocked_quantity: normalizeNumber(destination.blocked_quantity),
          version: normalizeNumber(destination.version) + 1,
          last_modified: timestamp,
        },
        { merge: true }
      );

      transaction.set(movementOutRef, {
        variant_id: variantId,
        warehouse_id: fromWarehouseId,
        movement_type: 'transfer_out',
        quantity,
        idempotency_key: `${idempotencyKey}_out`,
        related_movement_id: movementInRef.id,
        timestamp,
        notes: `Transferred to warehouse ${toWarehouseId}`,
        status: 'completed',
      });

      transaction.set(movementInRef, {
        variant_id: variantId,
        warehouse_id: toWarehouseId,
        movement_type: 'transfer_in',
        quantity,
        idempotency_key: `${idempotencyKey}_in`,
        related_movement_id: movementOutRef.id,
        timestamp,
        notes: `Transferred from warehouse ${fromWarehouseId}`,
        status: 'completed',
      });

      transaction.set(invoiceRef, {
        invoice_number: `TR-${Date.now()}`,
        variant_id: variantId,
        quantity,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        movement_out_id: movementOutRef.id,
        movement_in_id: movementInRef.id,
        created_at: timestamp,
      });

      transaction.set(transferRef, {
        transfer_number: `TRF-${Date.now()}`,
        transfer_type: 'warehouse_transfer',
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        product_variant_id: variantId,
        quantity,
        status: 'completed',
        movement_out_id: movementOutRef.id,
        movement_in_id: movementInRef.id,
        transfer_invoice_id: invoiceRef.id,
        created_at: timestamp,
      });
    });
  },

  async processBuyOrder(
    input: ProcessBuyOrderInput
  ) {
    const {
      variantId,
      productId,
      clientId,
      clientName,
      requestedQuantity,
      warehouseAllocations,
      supplierId,
      supplierQuantity,
      receivingWarehouseId,
      unitCost,
      vatRate,
      idempotencyKey,
    } = input;

    assertPositiveQuantity(requestedQuantity);
    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const normalizedAllocations = warehouseAllocations
      .map((allocation) => ({
        warehouseId: allocation.warehouseId,
        quantity: normalizeNumber(allocation.quantity),
      }))
      .filter((allocation) => allocation.warehouseId && allocation.quantity > 0);

    const totalFromWarehouses = normalizedAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);

    if (totalFromWarehouses > requestedQuantity) {
      throw new Error('Warehouse allocation cannot exceed requested quantity');
    }

    if (supplierQuantity < 0) {
      throw new Error('Supplier quantity cannot be negative');
    }

    if (totalFromWarehouses + supplierQuantity !== requestedQuantity) {
      throw new Error('Supplier quantity must match the remaining required quantity');
    }

    if (!supplierId) {
      throw new Error('Supplier selection is required for this transaction');
    }

    if (supplierQuantity > 0) {
      if (!receivingWarehouseId) {
        throw new Error('A receiving warehouse is required for supplier delivery');
      }
      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        throw new Error('Unit cost must be greater than zero when sourcing from a supplier');
      }
      if (!Number.isFinite(vatRate) || vatRate < 0) {
        throw new Error('A valid VAT rate is required');
      }
    }

    const affectedWarehouseIds = Array.from(
      new Set([
        ...normalizedAllocations.map((allocation) => allocation.warehouseId),
        ...(supplierQuantity > 0 && receivingWarehouseId ? [receivingWarehouseId] : []),
      ])
    );

    const balanceEntries = await Promise.all(
      affectedWarehouseIds.map(async (warehouseId) => {
        const balanceQuery = await getBalanceQuerySnapshot(variantId, warehouseId);
        return {
          warehouseId,
          ref: balanceQuery.empty ? doc(collection(db, BALANCES_COLLECTION)) : balanceQuery.docs[0].ref,
        };
      })
    );

    const balanceRefByWarehouseId = new Map(balanceEntries.map((entry) => [entry.warehouseId, entry.ref]));
    const issueMovements = normalizedAllocations.map((allocation) => ({
      ...allocation,
      ref: doc(collection(db, MOVEMENTS_COLLECTION)),
    }));
    const receiptMovementRef = supplierQuantity > 0 ? doc(collection(db, MOVEMENTS_COLLECTION)) : null;
    const purchaseInvoiceRef = doc(collection(db, PURCHASE_INVOICES_COLLECTION));
    const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
    const inventoryUpdateRef = doc(collection(db, INVENTORY_UPDATE_RECORDS_COLLECTION));
    const supplierRelationRef = supplierQuantity > 0 ? doc(collection(db, SUPPLIER_PRODUCT_RELATIONS_COLLECTION)) : null;
    const timestamp = nowIso();
    const subtotal = supplierQuantity * unitCost;
    const vatAmount = subtotal * (vatRate / 100);
    const totalCost = subtotal + vatAmount;
    const balanceDeltas = new Map<string, number>();

    for (const allocation of normalizedAllocations) {
      balanceDeltas.set(
        allocation.warehouseId,
        normalizeNumber(balanceDeltas.get(allocation.warehouseId)) - allocation.quantity
      );
    }

    if (supplierQuantity > 0 && receivingWarehouseId) {
      balanceDeltas.set(
        receivingWarehouseId,
        normalizeNumber(balanceDeltas.get(receivingWarehouseId)) + supplierQuantity
      );
    }

    await runTransaction(db, async (transaction) => {
      for (const allocation of normalizedAllocations) {
        const balanceRef = balanceRefByWarehouseId.get(allocation.warehouseId);
        if (!balanceRef) {
          throw new Error('Missing warehouse balance reference');
        }

        const balanceSnapshot = await transaction.get(balanceRef);
        const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;
        const availableQuantity = normalizeNumber(current.available_quantity);

        if (availableQuantity < allocation.quantity) {
          throw new Error('Cannot allocate more warehouse stock than available');
        }
      }

      for (const warehouseId of affectedWarehouseIds) {
        const balanceRef = balanceRefByWarehouseId.get(warehouseId);
        if (!balanceRef) {
          throw new Error('Missing warehouse balance reference');
        }

        const balanceSnapshot = await transaction.get(balanceRef);
        const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;
        const newAvailable = normalizeNumber(current.available_quantity) + normalizeNumber(balanceDeltas.get(warehouseId));

        if (newAvailable < 0) {
          throw new Error('Inventory cannot be reduced below zero');
        }

        transaction.set(
          balanceRef,
          {
            variant_id: variantId,
            warehouse_id: warehouseId,
            available_quantity: newAvailable,
            reserved_quantity: normalizeNumber(current.reserved_quantity),
            blocked_quantity: normalizeNumber(current.blocked_quantity),
            version: normalizeNumber(current.version) + 1,
            last_modified: timestamp,
          },
          { merge: true }
        );
      }

      for (const movement of issueMovements) {
        transaction.set(movement.ref, {
          variant_id: variantId,
          warehouse_id: movement.warehouseId,
          movement_type: 'issue',
          quantity: movement.quantity,
          idempotency_key: `${idempotencyKey}_issue_${movement.warehouseId}`,
          timestamp,
          customer_name: clientName,
          client_id: clientId,
          notes: `Allocated from warehouse stock for buy flow`,
          status: 'completed',
          transaction_id: idempotencyKey,
        });
      }

      if (receiptMovementRef && receivingWarehouseId) {
        transaction.set(receiptMovementRef, {
          variant_id: variantId,
          warehouse_id: receivingWarehouseId,
          movement_type: 'receipt',
          quantity: supplierQuantity,
          idempotency_key: `${idempotencyKey}_receipt`,
          timestamp,
          source_reference: supplierId,
          notes: 'Supplier delivery received into warehouse for buy flow',
          status: 'completed',
          transaction_id: idempotencyKey,
        });
      }

      transaction.set(purchaseInvoiceRef, {
        invoice_number: `PO-${Date.now()}`,
        supplier_id: supplierId ?? null,
        product_id: productId,
        product_variant_id: variantId,
        client_id: clientId,
        requested_quantity: requestedQuantity,
        quantity_purchased: supplierQuantity,
        quantity_from_warehouse: totalFromWarehouses,
        warehouse_allocations: normalizedAllocations,
        receiving_warehouse_id: receivingWarehouseId ?? null,
        unit_cost: supplierQuantity > 0 ? unitCost : 0,
        vat_rate: supplierQuantity > 0 ? vatRate : 0,
        subtotal,
        vat_amount: vatAmount,
        total_cost: totalCost,
        status: supplierQuantity > 0 ? 'received' : 'not_required',
        created_at: timestamp,
      });

      transaction.set(transferRef, {
        transfer_number: `TRF-${Date.now()}`,
        transfer_type: 'buy_order',
        client_id: clientId,
        customer_name: clientName,
        supplier_id: supplierId ?? null,
        warehouse_id: receivingWarehouseId ?? normalizedAllocations[0]?.warehouseId ?? null,
        product_id: productId,
        product_variant_id: variantId,
        quantity: requestedQuantity,
        subtotal,
        vat_rate: supplierQuantity > 0 ? vatRate : 0,
        vat_amount: supplierQuantity > 0 ? vatAmount : 0,
        total_amount: totalCost,
        status: 'completed',
        purchase_invoice_id: purchaseInvoiceRef.id,
        movement_ids: [
          ...issueMovements.map((movement) => movement.ref.id),
          ...(receiptMovementRef ? [receiptMovementRef.id] : []),
        ],
        created_at: timestamp,
      });

      transaction.set(inventoryUpdateRef, {
        idempotency_key: idempotencyKey,
        client_id: clientId,
        client_name: clientName,
        product_id: productId,
        variant_id: variantId,
        requested_quantity: requestedQuantity,
        quantity_from_warehouse: totalFromWarehouses,
        supplier_quantity: supplierQuantity,
        warehouse_allocations: normalizedAllocations,
        receiving_warehouse_id: receivingWarehouseId ?? null,
        purchase_invoice_id: purchaseInvoiceRef.id,
        movement_ids: [
          ...issueMovements.map((movement) => movement.ref.id),
          ...(receiptMovementRef ? [receiptMovementRef.id] : []),
        ],
        created_at: timestamp,
        status: 'completed',
      });

      if (supplierRelationRef && supplierId) {
        transaction.set(supplierRelationRef, {
          supplier_id: supplierId,
          product_id: productId,
          variant_id: variantId,
          client_id: clientId,
          purchase_invoice_id: purchaseInvoiceRef.id,
          quantity: supplierQuantity,
          unit_cost: unitCost,
          vat_rate: vatRate,
          total_cost: totalCost,
          warehouse_id: receivingWarehouseId ?? null,
          created_at: timestamp,
        });
      }
    });
  },

  async buyFromCustomer(input: BuyFromCustomerInput) {
    const {
      variantId,
      productId,
      clientId,
      clientName,
      warehouseId,
      quantity,
      unitCost,
      deliveryStatus,
      deliveryAddress,
      deliveryFee,
      notes,
      idempotencyKey,
      transactionTime,
    } = input;

    assertPositiveQuantity(quantity);
    if (!clientId) throw new Error('Customer is required');
    if (!warehouseId) throw new Error('Warehouse is required');
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error('Buy price must be zero or greater');
    }
    if (!Number.isFinite(normalizeNumber(deliveryFee)) || normalizeNumber(deliveryFee) < 0) {
      throw new Error('Delivery fee must be zero or greater');
    }

    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const balanceQuery = await getBalanceQuerySnapshot(variantId, warehouseId);
    const balanceRef = balanceQuery.empty
      ? doc(collection(db, BALANCES_COLLECTION))
      : balanceQuery.docs[0].ref;
    const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const purchaseInvoiceRef = doc(collection(db, PURCHASE_INVOICES_COLLECTION));
    const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
    const inventoryUpdateRef = doc(collection(db, INVENTORY_UPDATE_RECORDS_COLLECTION));
    const timestamp = transactionTime || nowIso();
    const subtotal = quantity * unitCost;
    const normalizedDeliveryFee = normalizeNumber(deliveryFee);
    const totalCost = subtotal + normalizedDeliveryFee;

    await runTransaction(db, async (transaction) => {
      const balanceSnapshot = await transaction.get(balanceRef);
      const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;

      transaction.set(
        balanceRef,
        {
          variant_id: variantId,
          warehouse_id: warehouseId,
          available_quantity: normalizeNumber(current.available_quantity) + quantity,
          reserved_quantity: normalizeNumber(current.reserved_quantity),
          blocked_quantity: normalizeNumber(current.blocked_quantity),
          version: normalizeNumber(current.version) + 1,
          last_modified: timestamp,
        },
        { merge: true }
      );

      transaction.set(movementRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        movement_type: 'receipt',
        quantity,
        idempotency_key: idempotencyKey,
        timestamp,
        customer_name: clientName,
        client_id: clientId,
        unit_cost: unitCost,
        source_reference: clientId,
        delivery_status: deliveryStatus || 'pending',
        delivery_address: deliveryAddress || '',
        delivery_fee: normalizedDeliveryFee,
        notes: notes || 'Stock purchased from customer into warehouse',
        status: 'completed',
        transaction_id: idempotencyKey,
      });

      transaction.set(purchaseInvoiceRef, {
        invoice_number: `PC-${Date.now()}`,
        supplier_id: null,
        client_id: clientId,
        source_type: 'customer',
        product_id: productId,
        product_variant_id: variantId,
        requested_quantity: quantity,
        quantity_purchased: quantity,
        quantity_from_warehouse: 0,
        warehouse_allocations: [],
        receiving_warehouse_id: warehouseId,
        unit_cost: unitCost,
        vat_rate: 0,
        subtotal,
        vat_amount: 0,
        delivery_fee: normalizedDeliveryFee,
        delivery_status: deliveryStatus || 'pending',
        delivery_address: deliveryAddress || '',
        total_cost: totalCost,
        status: 'received',
        payment_status: 'pending',
        paid_amount: 0,
        created_at: timestamp,
      });

      transaction.set(transferRef, {
        transfer_number: `TRF-${Date.now()}`,
        transfer_type: 'buy',
        client_id: clientId,
        customer_name: clientName,
        warehouse_id: warehouseId,
        product_id: productId,
        product_variant_id: variantId,
        quantity,
        subtotal,
        vat_rate: 0,
        vat_amount: 0,
        total_amount: totalCost,
        status: 'completed',
        movement_id: movementRef.id,
        purchase_invoice_id: purchaseInvoiceRef.id,
        created_at: timestamp,
      });

      transaction.set(inventoryUpdateRef, {
        idempotency_key: idempotencyKey,
        client_id: clientId,
        client_name: clientName,
        source_type: 'customer',
        product_id: productId,
        variant_id: variantId,
        requested_quantity: quantity,
        quantity_from_warehouse: 0,
        supplier_quantity: 0,
        purchased_from_customer_quantity: quantity,
        warehouse_allocations: [],
        receiving_warehouse_id: warehouseId,
        delivery_status: deliveryStatus || 'pending',
        delivery_address: deliveryAddress || '',
        delivery_fee: normalizedDeliveryFee,
        purchase_invoice_id: purchaseInvoiceRef.id,
        movement_ids: [movementRef.id],
        created_at: timestamp,
        status: 'completed',
      });
    });
  },

  async returnStock(input: ReturnStockInput) {
    const {
      variantId,
      productId,
      clientId,
      clientName,
      warehouseId,
      quantity,
      unitAmount,
      returnScope,
      notes,
      idempotencyKey,
      transactionTime,
      originalInvoiceId,
    } = input;

    assertPositiveQuantity(quantity);
    if (!clientId) throw new Error('Customer is required');
    if (!warehouseId) throw new Error('Warehouse is required');
    if (!Number.isFinite(unitAmount) || unitAmount < 0) {
      throw new Error('Return amount must be zero or greater');
    }

    await ensureIdempotencyKeyIsUnused(idempotencyKey);

    const balanceQuery = await getBalanceQuerySnapshot(variantId, warehouseId);
    if (returnScope === 'purchase' && balanceQuery.empty) {
      throw new Error('No inventory balance found for this variant in the selected warehouse');
    }

    const balanceRef = balanceQuery.empty
      ? doc(collection(db, BALANCES_COLLECTION))
      : balanceQuery.docs[0].ref;
    const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
    const returnInvoiceRef = doc(collection(db, RETURN_INVOICES_COLLECTION));
    const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
    const timestamp = transactionTime || nowIso();
    const totalAmount = quantity * unitAmount;
    const isOutgoingReturn = returnScope === 'purchase';

    await runTransaction(db, async (transaction) => {
      const balanceSnapshot = await transaction.get(balanceRef);
      const current = (balanceSnapshot.data() ?? {}) as BalanceRecord;
      const availableQuantity = normalizeNumber(current.available_quantity);

      if (isOutgoingReturn && availableQuantity < quantity) {
        throw new Error('Not enough stock in the selected warehouse for this return');
      }

      transaction.set(
        balanceRef,
        {
          variant_id: variantId,
          warehouse_id: warehouseId,
          available_quantity: availableQuantity + (isOutgoingReturn ? -quantity : quantity),
          reserved_quantity: normalizeNumber(current.reserved_quantity),
          blocked_quantity: normalizeNumber(current.blocked_quantity),
          version: normalizeNumber(current.version) + 1,
          last_modified: timestamp,
        },
        { merge: true }
      );

      transaction.set(movementRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        movement_type: 'return',
        quantity,
        idempotency_key: idempotencyKey,
        timestamp,
        customer_name: clientName,
        client_id: clientId,
        return_scope: returnScope,
        return_direction: isOutgoingReturn ? 'out' : 'in',
        notes: notes || (returnScope === 'sale' ? `Customer returned stock from sale` : `Returned purchased stock back to customer`),
        status: 'completed',
      });

      transaction.set(returnInvoiceRef, {
        invoice_number: `RTN-${Date.now()}`,
        client_id: clientId,
        customer_name: clientName,
        product_id: productId,
        product_variant_id: variantId,
        warehouse_id: warehouseId,
        quantity,
        unit_amount: unitAmount,
        total_amount: totalAmount,
        return_scope: returnScope,
        return_direction: isOutgoingReturn ? 'out' : 'in',
        original_invoice_id: originalInvoiceId ?? null,
        movement_id: movementRef.id,
        status: 'completed',
        notes: notes || '',
        created_at: timestamp,
      });

      transaction.set(transferRef, {
        transfer_number: `TRF-${Date.now()}`,
        transfer_type: returnScope === 'sale' ? 'sale_return' : 'buy_return',
        client_id: clientId,
        customer_name: clientName,
        warehouse_id: warehouseId,
        product_id: productId,
        product_variant_id: variantId,
        quantity,
        total_amount: totalAmount,
        status: 'completed',
        movement_id: movementRef.id,
        return_invoice_id: returnInvoiceRef.id,
        created_at: timestamp,
      });
    });
  },
};

export default InventoryService;
