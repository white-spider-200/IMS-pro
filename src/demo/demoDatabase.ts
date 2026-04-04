import * as demoData from './demoData';
import { calculateClientFinancials } from '../lib/clientFinancials';

const STORAGE_KEY = 'ims-pro-demo-database';
const EVENT_NAME = 'ims-pro-demo-database-change';
export type DemoDatabase = {
  brands: any[];
  categories: any[];
  suppliers: any[];
  clients: any[];
  warehouses: any[];
  products: any[];
  product_variants: any[];
  inventory_balances: any[];
  stock_movements: any[];
  revenue_invoices: any[];
  purchase_invoices: any[];
  return_invoices: any[];
  client_payments: any[];
  warehouse_expenses: any[];
  transfer_invoices: any[];
  transfers: any[];
  inventory_update_records: any[];
  supplier_product_relations: any[];
  users: any[];
};

function buildInitialDatabase(): DemoDatabase {
  const brands = demoData.demoBrands.map((brand) => ({ ...brand, created_at: new Date().toISOString() }));
  const categories = demoData.demoCategories.map((category) => ({
    ...category,
    category_code: category.id.toUpperCase(),
    created_at: new Date().toISOString(),
  }));
  const suppliers = demoData.demoSuppliers.map((supplier, index) => ({
    ...supplier,
    supplier_code: `SUP-DEMO-${index + 1}`,
    email: supplier.contact_info,
    phone: '',
    created_at: new Date().toISOString(),
  }));
  const clients = demoData.demoClients.map((client) => ({
    ...client,
    balance_due: Number(client.balance_due || 0),
    paid_amount: Number(client.paid_amount || 0),
    credit_balance: Number(client.credit_balance || 0),
    total_billed: Number(client.total_billed || 0),
    pending_amount: Number(client.pending_amount || 0),
    balance: Number(client.balance || 0),
    created_at: new Date().toISOString(),
  }));
  const warehouses = demoData.demoWarehouses.map((warehouse) => ({
    ...warehouse,
    manual_manager_name: '',
    manual_manager_phone: '',
    manual_manager_email: warehouse.manager_email,
    created_at: new Date().toISOString(),
  }));
  const products = demoData.demoProducts.map((product) => ({
    ...product,
    brand_id: brands.find((brand) => brand.name === product.brand)?.id || brands[0]?.id || '',
    category_id: categories.find((category) => category.name === product.category)?.id || '',
    supplier_id: suppliers.find((supplier) => supplier.name === product.supplier)?.id || '',
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
  }));
  const product_variants = demoData.demoVariants.map((variant) => ({
    ...variant,
    product_id: products.find((product) => product.name === variant.product)?.id || '',
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
  }));
  const inventory_balances = demoData.demoInventory.map((item, index) => ({
    id: item.id || `inv-${index + 1}`,
    variant_id: product_variants.find((variant) => variant.variant_code === item.variant)?.id || '',
    warehouse_id: warehouses.find((warehouse) => warehouse.name === item.warehouse)?.id || '',
    available_quantity: item.available,
    reserved_quantity: item.reserved,
    blocked_quantity: 0,
    version: 1,
    last_modified: new Date().toISOString(),
  }));
  const stock_movements = demoData.demoMovements.map((movement) => ({
    ...movement,
    variant_id: product_variants.find((variant) => variant.variant_code === movement.variant)?.id || '',
    warehouse_id: warehouses.find((warehouse) => warehouse.name === movement.warehouse)?.id || '',
  }));
  const users = demoData.demoUsers.map((user) => ({ ...user, created_at: new Date().toISOString() }));

  return {
    brands,
    categories,
    suppliers,
    clients,
    warehouses,
    products,
    product_variants,
    inventory_balances,
    stock_movements,
    revenue_invoices: [],
    purchase_invoices: [],
    return_invoices: [],
    client_payments: [],
    warehouse_expenses: [],
    transfer_invoices: [],
    transfers: [],
    inventory_update_records: [],
    supplier_product_relations: [],
    users,
  };
}

function writeStorage(database: DemoDatabase, emitEvent: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  if (emitEvent) {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

function persist(database: DemoDatabase) {
  writeStorage(database, true);
}

function getDemoInvoiceTotal(invoice: any) {
  return Number(invoice?.total_amount ?? invoice?.total_cost ?? 0);
}

function getDemoInvoicePaidAmount(database: DemoDatabase, invoiceId: string) {
  return (database.client_payments || [])
    .filter((payment) => payment.invoice_id === invoiceId)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getDemoInvoicePaymentStatus(database: DemoDatabase, invoice: any) {
  if (invoice?.status === 'cancelled') return 'cancelled';

  const total = getDemoInvoiceTotal(invoice);
  const paid = getDemoInvoicePaidAmount(database, invoice.id);

  if (paid <= 0) return 'pending';
  if (paid >= total) return 'paid';
  return 'partial';
}

function parseDemoTimestamp(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function assertDemoTransactionValue(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or greater`);
  }
}

function getDemoAverageBuyCostForVariantAtTime(database: DemoDatabase, variantId: string, timestamp: string) {
  const totals = (database.purchase_invoices || []).reduce(
    (accumulator, invoice) => {
      if (!invoice || invoice.status === 'cancelled') return accumulator;
      if (String(invoice.product_variant_id || '') !== String(variantId || '')) return accumulator;
      if (parseDemoTimestamp(invoice.created_at) > parseDemoTimestamp(timestamp)) return accumulator;

      const quantity = Number(invoice.quantity_purchased ?? invoice.requested_quantity ?? 0);
      const unitCost = Number(invoice.unit_cost ?? 0);

      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return accumulator;
      }

      return {
        quantity: accumulator.quantity + quantity,
        cost: accumulator.cost + (quantity * unitCost),
      };
    },
    { quantity: 0, cost: 0 }
  );

  return totals.quantity > 0 ? totals.cost / totals.quantity : 0;
}

function syncClientFinancials(database: DemoDatabase, clientId?: string | null, customerName?: string | null) {
  const client = database.clients.find((entry) => {
    if (clientId && entry.id === clientId) return true;
    return customerName && String(entry.name || '').trim().toLowerCase() === String(customerName || '').trim().toLowerCase();
  });

  if (!client) return;

  Object.assign(
    client,
    calculateClientFinancials(
      client,
      database.revenue_invoices,
      database.purchase_invoices,
      database.client_payments
    )
  );
}

function migrateDemoDatabase(database: DemoDatabase): DemoDatabase {
  const fresh = buildInitialDatabase();

  const brands = (database.brands || []).map((brand) => {
    const fallback = fresh.brands.find((entry) => entry.id === brand.id || entry.name === brand.name);
    return {
      ...fallback,
      ...brand,
      logo_url: brand.logo_url || fallback?.logo_url || '',
    };
  });

  const products = (database.products || []).map((product) => {
    const fallback = fresh.products.find((entry) => entry.id === product.id || entry.name === product.name);
    return {
      ...fallback,
      ...product,
      brand: product.brand || fallback?.brand || '',
      image_url: product.image_url || fallback?.image_url || '',
      brand_id: product.brand_id || fallback?.brand_id || '',
    };
  });

  const clients = (database.clients || []).map((client) => {
    const fallback = fresh.clients.find((entry) => entry.id === client.id || entry.name === client.name);
    return {
      ...fallback,
      ...client,
      total_billed: Number(client.total_billed ?? fallback?.total_billed ?? 0),
      paid_amount: Number(client.paid_amount ?? fallback?.paid_amount ?? 0),
      pending_amount: Number(client.pending_amount ?? fallback?.pending_amount ?? 0),
      balance_due: Number(client.balance_due ?? fallback?.balance_due ?? 0),
      credit_balance: Number(client.credit_balance ?? fallback?.credit_balance ?? 0),
      balance: Number(client.balance ?? fallback?.balance ?? 0),
    };
  });

  const migrated = {
    ...fresh,
    ...database,
    brands,
    clients,
    products,
    purchase_invoices: database.purchase_invoices || fresh.purchase_invoices,
    return_invoices: database.return_invoices || fresh.return_invoices,
    client_payments: database.client_payments || fresh.client_payments,
    warehouse_expenses: database.warehouse_expenses || fresh.warehouse_expenses,
    transfer_invoices: database.transfer_invoices || fresh.transfer_invoices,
    transfers: database.transfers || fresh.transfers,
    inventory_update_records: database.inventory_update_records || fresh.inventory_update_records,
    supplier_product_relations: database.supplier_product_relations || fresh.supplier_product_relations,
  };

  return migrated;
}

export function getDemoDatabase(): DemoDatabase {
  if (typeof window === 'undefined') {
    return buildInitialDatabase();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = buildInitialDatabase();
      writeStorage(initial, false);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const migrated = migrateDemoDatabase(parsed);
      writeStorage(migrated, false);
      return migrated;
    }
    return buildInitialDatabase();
  } catch {
    return buildInitialDatabase();
  }
}

export function resetDemoDatabase() {
  persist(buildInitialDatabase());
}

export function clearDemoDatabase() {
  persist({
    brands: [],
    categories: [],
    suppliers: [],
    clients: [],
    warehouses: [],
    products: [],
    product_variants: [],
    inventory_balances: [],
    stock_movements: [],
    revenue_invoices: [],
    purchase_invoices: [],
    return_invoices: [],
    client_payments: [],
    warehouse_expenses: [],
    transfer_invoices: [],
    transfers: [],
    inventory_update_records: [],
    supplier_product_relations: [],
    users: [],
  });
}

export function subscribeDemoDatabase(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(EVENT_NAME, onChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(EVENT_NAME, onChange);
  };
}

export function saveDemoCollectionItem(collectionName: keyof DemoDatabase, item: any) {
  const database = getDemoDatabase();
  const collection = database[collectionName] || [];
  const record = item.id
    ? item
    : {
        ...item,
        id: `${collectionName}-${crypto.randomUUID()}`,
      };
  const nextCollection = record.id
    ? collection.some((entry: any) => entry.id === record.id)
      ? collection.map((entry: any) => (entry.id === record.id ? record : entry))
      : [...collection, record]
    : collection;

  persist({
    ...database,
    [collectionName]: nextCollection,
  });
}

export function removeDemoCollectionItem(collectionName: keyof DemoDatabase, id: string) {
  const database = getDemoDatabase();
  persist({
    ...database,
    [collectionName]: (database[collectionName] || []).filter((entry: any) => entry.id !== id),
  });
}

function upsertBalance(database: DemoDatabase, variantId: string, warehouseId: string, quantityDelta: number) {
  const existing = database.inventory_balances.find(
    (entry) => entry.variant_id === variantId && entry.warehouse_id === warehouseId
  );

  if (existing) {
    existing.available_quantity = Number(existing.available_quantity || 0) + quantityDelta;
    existing.last_modified = new Date().toISOString();
    existing.version = Number(existing.version || 0) + 1;
    return existing;
  }

  const created = {
    id: `inv-${crypto.randomUUID()}`,
    variant_id: variantId,
    warehouse_id: warehouseId,
    available_quantity: quantityDelta,
    reserved_quantity: 0,
    blocked_quantity: 0,
    version: 1,
    last_modified: new Date().toISOString(),
  };
  database.inventory_balances.push(created);
  return created;
}

export function receiveDemoStock(variantId: string, warehouseId: string, quantity: number, batchId: string) {
  const database = getDemoDatabase();
  upsertBalance(database, variantId, warehouseId, quantity);
  database.stock_movements.unshift({
    id: `mov-${crypto.randomUUID()}`,
    variant_id: variantId,
    warehouse_id: warehouseId,
    movement_type: 'receipt',
    quantity,
    batch_id: batchId,
    status: 'completed',
    timestamp: new Date().toISOString(),
    notes: `Stock received for batch ${batchId}`,
  });
  persist(database);
}

export function buyFromCustomerDemoStock(
  variantId: string,
  productId: string,
  warehouseId: string,
  quantity: number,
  clientId: string,
  clientName: string,
  unitCost: number,
  options: {
    deliveryStatus?: string;
    deliveryAddress?: string;
    deliveryFee?: number;
    paymentAmount?: number;
    paymentNotes?: string;
    notes?: string;
    transactionTime?: string;
  },
  idempotencyKey: string
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  const database = getDemoDatabase();
  const existingRecord = database.inventory_update_records.find(
    (entry) => entry.idempotency_key === idempotencyKey
  );

  if (existingRecord) {
    throw new Error('This inventory operation has already been processed');
  }

  const timestamp = options.transactionTime || new Date().toISOString();
  const subtotal = quantity * Number(unitCost || 0);
  const deliveryFee = Number(options.deliveryFee || 0);
  const totalCost = subtotal + deliveryFee;
  const paymentAmount = Number(options.paymentAmount || 0);
  assertDemoTransactionValue(paymentAmount, 'Payment amount');
  if (paymentAmount > totalCost) {
    throw new Error('Payment amount cannot exceed total cost');
  }
  const paymentStatus = paymentAmount <= 0 ? 'pending' : paymentAmount >= totalCost ? 'paid' : 'partial';
  const movementId = `mov-${crypto.randomUUID()}`;
  const purchaseInvoiceId = `po-${crypto.randomUUID()}`;
  const transferId = `trf-${crypto.randomUUID()}`;
  const invoiceNumber = `PC-${Date.now()}`;

  upsertBalance(database, variantId, warehouseId, quantity);

  database.stock_movements.unshift({
    id: movementId,
    variant_id: variantId,
    warehouse_id: warehouseId,
    movement_type: 'receipt',
    quantity,
    status: 'completed',
    timestamp,
    customer_name: clientName,
    client_id: clientId,
    unit_cost: Number(unitCost || 0),
    source_reference: clientId,
    delivery_status: options.deliveryStatus || 'pending',
    delivery_address: options.deliveryAddress || '',
    delivery_fee: deliveryFee,
    idempotency_key: idempotencyKey,
    transaction_id: idempotencyKey,
    notes: options.notes || 'Stock purchased from customer into warehouse',
  });

  database.purchase_invoices.unshift({
    id: purchaseInvoiceId,
    invoice_number: invoiceNumber,
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
    unit_cost: Number(unitCost || 0),
    vat_rate: 0,
    subtotal,
    vat_amount: 0,
    delivery_fee: deliveryFee,
    delivery_status: options.deliveryStatus || 'pending',
    delivery_address: options.deliveryAddress || '',
    total_cost: totalCost,
    status: 'received',
    payment_status: paymentStatus,
    paid_amount: paymentAmount,
    paid_at: paymentStatus === 'paid' ? timestamp : null,
    created_at: timestamp,
  });

  if (paymentAmount > 0) {
    database.client_payments.unshift({
      id: `pay-${crypto.randomUUID()}`,
      client_id: clientId,
      client_name: clientName,
      direction: 'outgoing',
      scope: 'purchase',
      invoice_id: purchaseInvoiceId,
      invoice_number: invoiceNumber,
      receipt_number: `PAY-${Date.now()}`,
      amount: paymentAmount,
      notes: options.paymentNotes || options.notes || `Payment recorded with customer purchase invoice ${invoiceNumber}`,
      created_at: timestamp,
      warehouse_id: warehouseId,
    });
  }

  database.transfers.unshift({
    id: transferId,
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
    movement_id: movementId,
    purchase_invoice_id: purchaseInvoiceId,
    created_at: timestamp,
  });

  database.inventory_update_records.unshift({
    id: `upd-${crypto.randomUUID()}`,
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
    delivery_status: options.deliveryStatus || 'pending',
    delivery_address: options.deliveryAddress || '',
    delivery_fee: deliveryFee,
    purchase_invoice_id: purchaseInvoiceId,
    movement_ids: [movementId],
    created_at: timestamp,
    status: 'completed',
  });

  syncClientFinancials(database, clientId, clientName);
  persist(database);
}

export function issueDemoStock(
  variantId: string,
  warehouseId: string,
  quantity: number,
  customerName: string,
  clientId: string | undefined,
  unitPrice: number,
  options: {
    vatRate?: number;
    deliveryStatus?: string;
    deliveryAddress?: string;
    deliveryFee?: number;
    paymentAmount?: number;
    paymentNotes?: string;
    notes?: string;
    transactionTime?: string;
  } = {}
) {
  const database = getDemoDatabase();
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  assertDemoTransactionValue(unitPrice, 'Sell price');
  const balance = database.inventory_balances.find(
    (entry) => entry.variant_id === variantId && entry.warehouse_id === warehouseId
  );
  const available = Number(balance?.available_quantity || 0);

  if (!balance || available < quantity) {
    throw new Error('Insufficient available stock for this issue');
  }

  balance.available_quantity = available - quantity;
  balance.last_modified = new Date().toISOString();
  balance.version = Number(balance.version || 0) + 1;

  const movementId = `mov-${crypto.randomUUID()}`;
  const timestamp = options.transactionTime || new Date().toISOString();
  const vatRate = Number(options.vatRate || 0);
  const deliveryFee = Number(options.deliveryFee || 0);
  assertDemoTransactionValue(vatRate, 'VAT');
  if (vatRate > 100) {
    throw new Error('VAT cannot exceed 100%');
  }
  assertDemoTransactionValue(deliveryFee, 'Delivery fee');
  const subtotal = quantity * unitPrice;
  const vatAmount = subtotal * (vatRate / 100);
  const totalAmount = subtotal + vatAmount + deliveryFee;
  const paymentAmount = Number(options.paymentAmount || 0);
  assertDemoTransactionValue(paymentAmount, 'Payment amount');
  if (paymentAmount > totalAmount) {
    throw new Error('Payment amount cannot exceed total amount');
  }
  assertDemoTransactionValue(subtotal, 'Subtotal');
  assertDemoTransactionValue(totalAmount, 'Total amount');
  const costPerUnitAtSale = getDemoAverageBuyCostForVariantAtTime(database, variantId, timestamp);
  const cogsAmount = quantity * costPerUnitAtSale;
  const grossProfit = subtotal - cogsAmount;
  const revenueInvoiceId = `inv-${crypto.randomUUID()}`;
  const transferId = `trf-${crypto.randomUUID()}`;
  const invoiceStatus = paymentAmount <= 0 ? 'pending' : paymentAmount >= totalAmount ? 'paid' : 'partial';
  const invoiceNumber = `INV-${Date.now()}`;
  database.stock_movements.unshift({
    id: movementId,
    variant_id: variantId,
    warehouse_id: warehouseId,
    movement_type: 'issue',
    quantity,
    status: 'completed',
    timestamp,
    customer_name: customerName,
    client_id: clientId || null,
    notes: options.notes || `Issued stock to ${customerName}`,
  });

  database.revenue_invoices.unshift({
    id: revenueInvoiceId,
    invoice_number: invoiceNumber,
    customer_name: customerName,
    client_id: clientId || null,
    items: [{ variant_id: variantId, quantity, unit_price: unitPrice, total: subtotal }],
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    delivery_fee: deliveryFee,
    delivery_status: options.deliveryStatus || 'pending',
    delivery_address: options.deliveryAddress || '',
    cost_per_unit_at_sale: costPerUnitAtSale,
    cogs_amount: cogsAmount,
    gross_profit: grossProfit,
    total_amount: totalAmount,
    status: invoiceStatus,
    paid_amount: paymentAmount,
    paid_at: invoiceStatus === 'paid' ? timestamp : null,
    warehouse_id: warehouseId,
    movement_id: movementId,
    created_at: timestamp,
  });

  if (paymentAmount > 0) {
    database.client_payments.unshift({
      id: `pay-${crypto.randomUUID()}`,
      client_id: clientId || null,
      client_name: customerName,
      direction: 'incoming',
      scope: 'sale',
      invoice_id: revenueInvoiceId,
      invoice_number: invoiceNumber,
      receipt_number: `PAY-${Date.now()}`,
      amount: paymentAmount,
      notes: options.paymentNotes || options.notes || `Payment recorded with invoice ${invoiceNumber}`,
      created_at: timestamp,
      warehouse_id: warehouseId,
    });
  }

  database.transfers.unshift({
    id: transferId,
    transfer_number: `TRF-${Date.now()}`,
    transfer_type: 'sell',
    client_id: clientId || null,
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
    total_amount: totalAmount,
    status: 'completed',
    movement_id: movementId,
    revenue_invoice_id: revenueInvoiceId,
    created_at: timestamp,
  });

  syncClientFinancials(database, clientId, customerName);

  persist(database);
}

export function markDemoRevenueInvoicePaid(invoiceId: string) {
  const database = getDemoDatabase();
  const invoice = database.revenue_invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) return;

  const remainingAmount = Math.max(getDemoInvoiceTotal(invoice) - getDemoInvoicePaidAmount(database, invoice.id), 0);
  if (remainingAmount <= 0) return;

  addDemoClientPayment({
    clientId: invoice.client_id,
    clientName: invoice.customer_name,
    direction: 'incoming',
    scope: 'sale',
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    amount: remainingAmount,
    notes: 'Marked as fully paid from customer payments page',
  });
}

export function addDemoClientPayment(input: {
  clientId?: string | null;
  clientName: string;
  direction: 'incoming' | 'outgoing';
  scope: 'sale' | 'purchase';
  invoiceId: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  amount: number;
  notes?: string;
  createdAt?: string;
}) {
  const database = getDemoDatabase();
  const amount = Number(input.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const invoiceCollection = input.scope === 'sale' ? database.revenue_invoices : database.purchase_invoices;
  const invoice = invoiceCollection.find((entry) => entry.id === input.invoiceId);

  if (!invoice) {
    throw new Error('The selected invoice was not found');
  }

  const remainingAmount = Math.max(getDemoInvoiceTotal(invoice) - getDemoInvoicePaidAmount(database, invoice.id), 0);
  if (amount > remainingAmount) {
    throw new Error('Payment amount cannot exceed the remaining invoice balance');
  }

  const createdAt = input.createdAt || new Date().toISOString();
  const paymentId = `pay-${crypto.randomUUID()}`;

  database.client_payments.unshift({
    id: paymentId,
    client_id: input.clientId || invoice.client_id || null,
    client_name: input.clientName || invoice.customer_name || '',
    direction: input.direction,
    scope: input.scope,
    invoice_id: invoice.id,
    invoice_number: input.invoiceNumber || invoice.invoice_number || '',
    receipt_number: input.receiptNumber || `PAY-${Date.now()}`,
    amount,
    notes: input.notes || '',
    created_at: createdAt,
  });

  const paymentStatus = getDemoInvoicePaymentStatus(database, invoice);
  const paidAmount = getDemoInvoicePaidAmount(database, invoice.id);
  invoice.paid_amount = paidAmount;
  invoice.paid_at = paymentStatus === 'paid' ? createdAt : null;

  if (input.scope === 'sale') {
    invoice.status = paymentStatus;
  } else {
    invoice.payment_status = paymentStatus;
  }

  syncClientFinancials(database, input.clientId || invoice.client_id, input.clientName || invoice.customer_name);
  persist(database);
}

export function returnDemoStock(input: {
  variantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  clientId: string;
  clientName: string;
  unitAmount: number;
  returnScope: 'sale' | 'purchase';
  notes?: string;
  transactionTime?: string;
  originalInvoiceId?: string | null;
  idempotencyKey: string;
}) {
  const {
    variantId,
    productId,
    warehouseId,
    quantity,
    clientId,
    clientName,
    unitAmount,
    returnScope,
    notes,
    transactionTime,
    originalInvoiceId,
    idempotencyKey,
  } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  const database = getDemoDatabase();
  const existingMovement = database.stock_movements.find((entry) => entry.idempotency_key === idempotencyKey);
  if (existingMovement) {
    throw new Error('This inventory operation has already been processed');
  }

  const timestamp = transactionTime || new Date().toISOString();
  const totalAmount = quantity * Number(unitAmount || 0);
  const isOutgoingReturn = returnScope === 'purchase';
  const balance = database.inventory_balances.find(
    (entry) => entry.variant_id === variantId && entry.warehouse_id === warehouseId
  );
  const available = Number(balance?.available_quantity || 0);

  if (isOutgoingReturn && (!balance || available < quantity)) {
    throw new Error('Not enough stock in the selected warehouse for this return');
  }

  upsertBalance(database, variantId, warehouseId, isOutgoingReturn ? -quantity : quantity);

  const movementId = `mov-${crypto.randomUUID()}`;
  const returnInvoiceId = `rtn-${crypto.randomUUID()}`;
  const transferId = `trf-${crypto.randomUUID()}`;

  database.stock_movements.unshift({
    id: movementId,
    variant_id: variantId,
    warehouse_id: warehouseId,
    movement_type: 'return',
    quantity,
    status: 'completed',
    timestamp,
    customer_name: clientName,
    client_id: clientId,
    return_scope: returnScope,
    return_direction: isOutgoingReturn ? 'out' : 'in',
    idempotency_key: idempotencyKey,
    notes: notes || (returnScope === 'sale' ? 'Customer returned sold stock' : 'Returned purchased stock back to customer'),
  });

  database.return_invoices.unshift({
    id: returnInvoiceId,
    invoice_number: `RTN-${Date.now()}`,
    client_id: clientId,
    customer_name: clientName,
    product_id: productId,
    product_variant_id: variantId,
    warehouse_id: warehouseId,
    quantity,
    unit_amount: Number(unitAmount || 0),
    total_amount: totalAmount,
    return_scope: returnScope,
    return_direction: isOutgoingReturn ? 'out' : 'in',
    original_invoice_id: originalInvoiceId || null,
    movement_id: movementId,
    status: 'completed',
    notes: notes || '',
    created_at: timestamp,
  });

  database.transfers.unshift({
    id: transferId,
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
    movement_id: movementId,
    return_invoice_id: returnInvoiceId,
    created_at: timestamp,
  });

  persist(database);
}

export function transferDemoStock(
  variantId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number
) {
  const database = getDemoDatabase();
  const source = database.inventory_balances.find(
    (entry) => entry.variant_id === variantId && entry.warehouse_id === fromWarehouseId
  );
  const sourceAvailable = Number(source?.available_quantity || 0);

  if (!source || sourceAvailable < quantity) {
    throw new Error('Insufficient stock in the source warehouse');
  }

  source.available_quantity = sourceAvailable - quantity;
  source.last_modified = new Date().toISOString();
  source.version = Number(source.version || 0) + 1;

  upsertBalance(database, variantId, toWarehouseId, quantity);

  const movementOutId = `mov-${crypto.randomUUID()}`;
  const movementInId = `mov-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const transferInvoiceId = `tr-${crypto.randomUUID()}`;
  const transferId = `trf-${crypto.randomUUID()}`;

  database.stock_movements.unshift(
    {
      id: movementInId,
      variant_id: variantId,
      warehouse_id: toWarehouseId,
      movement_type: 'transfer_in',
      quantity,
      status: 'completed',
      timestamp,
      related_movement_id: movementOutId,
    },
    {
      id: movementOutId,
      variant_id: variantId,
      warehouse_id: fromWarehouseId,
      movement_type: 'transfer_out',
      quantity,
      status: 'completed',
      timestamp,
      related_movement_id: movementInId,
    }
  );

  database.transfer_invoices.unshift({
    id: transferInvoiceId,
    invoice_number: `TR-${Date.now()}`,
    variant_id: variantId,
    quantity,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    movement_out_id: movementOutId,
    movement_in_id: movementInId,
    created_at: timestamp,
  });

  database.transfers.unshift({
    id: transferId,
    transfer_number: `TRF-${Date.now()}`,
    transfer_type: 'warehouse_transfer',
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    product_variant_id: variantId,
    quantity,
    status: 'completed',
    movement_out_id: movementOutId,
    movement_in_id: movementInId,
    transfer_invoice_id: transferInvoiceId,
    created_at: timestamp,
  });

  persist(database);
}

type DemoBuyWarehouseAllocation = {
  warehouseId: string;
  quantity: number;
};

type ProcessDemoBuyOrderInput = {
  variantId: string;
  productId: string;
  clientId: string;
  clientName: string;
  requestedQuantity: number;
  warehouseAllocations: DemoBuyWarehouseAllocation[];
  supplierId?: string | null;
  supplierQuantity: number;
  receivingWarehouseId?: string | null;
  unitCost: number;
  vatRate: number;
  idempotencyKey: string;
};

export function processDemoBuyOrder(input: ProcessDemoBuyOrderInput) {
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

  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  const database = getDemoDatabase();
  const existingRecord = database.inventory_update_records.find(
    (entry) => entry.idempotency_key === idempotencyKey
  );

  if (existingRecord) {
    throw new Error('This inventory operation has already been processed');
  }

  const normalizedAllocations = warehouseAllocations
    .map((allocation) => ({
      warehouseId: allocation.warehouseId,
      quantity: Number(allocation.quantity || 0),
    }))
    .filter((allocation) => allocation.warehouseId && allocation.quantity > 0);

  const totalFromWarehouses = normalizedAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);

  if (totalFromWarehouses > requestedQuantity) {
    throw new Error('Warehouse allocation cannot exceed requested quantity');
  }

  if (totalFromWarehouses + supplierQuantity !== requestedQuantity) {
    throw new Error('Supplier quantity must match the remaining required quantity');
  }

  if (!supplierId) {
    throw new Error('Supplier selection is required for this transaction');
  }

  if (supplierQuantity > 0) {
    if (!receivingWarehouseId) throw new Error('Receiving warehouse is required');
    if (!Number.isFinite(unitCost) || unitCost <= 0) throw new Error('Unit cost must be greater than zero');
    if (!Number.isFinite(vatRate) || vatRate < 0) throw new Error('A valid VAT rate is required');
  }

  const timestamp = new Date().toISOString();
  const subtotal = supplierQuantity * unitCost;
  const vatAmount = subtotal * (vatRate / 100);
  const totalCost = subtotal + vatAmount;

  for (const allocation of normalizedAllocations) {
    const balance = database.inventory_balances.find(
      (entry) => entry.variant_id === variantId && entry.warehouse_id === allocation.warehouseId
    );
    const available = Number(balance?.available_quantity || 0);

    if (!balance || available < allocation.quantity) {
      throw new Error('Cannot allocate more warehouse stock than available');
    }
  }

  for (const allocation of normalizedAllocations) {
    upsertBalance(database, variantId, allocation.warehouseId, -allocation.quantity);
  }

  if (supplierQuantity > 0 && receivingWarehouseId) {
    upsertBalance(database, variantId, receivingWarehouseId, supplierQuantity);
  }

  const issueMovementIds = normalizedAllocations.map((allocation) => {
    const movementId = `mov-${crypto.randomUUID()}`;
    database.stock_movements.unshift({
      id: movementId,
      variant_id: variantId,
      warehouse_id: allocation.warehouseId,
      movement_type: 'issue',
      quantity: allocation.quantity,
      status: 'completed',
      timestamp,
      customer_name: clientName,
      client_id: clientId,
      idempotency_key: `${idempotencyKey}_issue_${allocation.warehouseId}`,
      transaction_id: idempotencyKey,
      notes: 'Allocated from warehouse stock for buy flow',
    });
    return movementId;
  });

  let receiptMovementId: string | null = null;
  if (supplierQuantity > 0 && receivingWarehouseId) {
    receiptMovementId = `mov-${crypto.randomUUID()}`;
    database.stock_movements.unshift({
      id: receiptMovementId,
      variant_id: variantId,
      warehouse_id: receivingWarehouseId,
      movement_type: 'receipt',
      quantity: supplierQuantity,
      status: 'completed',
      timestamp,
      source_reference: supplierId,
      idempotency_key: `${idempotencyKey}_receipt`,
      transaction_id: idempotencyKey,
      notes: 'Supplier delivery received into warehouse for buy flow',
    });
  }

  const purchaseInvoiceId = `po-${crypto.randomUUID()}`;
  const transferId = `trf-${crypto.randomUUID()}`;
  database.purchase_invoices.unshift({
    id: purchaseInvoiceId,
    invoice_number: `PO-${Date.now()}`,
    supplier_id: supplierId || null,
    product_id: productId,
    product_variant_id: variantId,
    client_id: clientId,
    requested_quantity: requestedQuantity,
    quantity_purchased: supplierQuantity,
    quantity_from_warehouse: totalFromWarehouses,
    warehouse_allocations: normalizedAllocations,
    receiving_warehouse_id: receivingWarehouseId || null,
    unit_cost: supplierQuantity > 0 ? unitCost : 0,
    vat_rate: supplierQuantity > 0 ? vatRate : 0,
    subtotal,
    vat_amount: vatAmount,
    total_cost: totalCost,
    status: supplierQuantity > 0 ? 'received' : 'not_required',
    created_at: timestamp,
  });

  database.transfers.unshift({
    id: transferId,
    transfer_number: `TRF-${Date.now()}`,
    transfer_type: 'buy_order',
    client_id: clientId,
    customer_name: clientName,
    supplier_id: supplierId || null,
    warehouse_id: receivingWarehouseId || normalizedAllocations[0]?.warehouseId || null,
    product_id: productId,
    product_variant_id: variantId,
    quantity: requestedQuantity,
    subtotal,
    vat_rate: supplierQuantity > 0 ? vatRate : 0,
    vat_amount: supplierQuantity > 0 ? vatAmount : 0,
    total_amount: totalCost,
    status: 'completed',
    purchase_invoice_id: purchaseInvoiceId,
    movement_ids: [...issueMovementIds, ...(receiptMovementId ? [receiptMovementId] : [])],
    created_at: timestamp,
  });

  database.inventory_update_records.unshift({
    id: `upd-${crypto.randomUUID()}`,
    idempotency_key: idempotencyKey,
    client_id: clientId,
    client_name: clientName,
    product_id: productId,
    variant_id: variantId,
    requested_quantity: requestedQuantity,
    quantity_from_warehouse: totalFromWarehouses,
    supplier_quantity: supplierQuantity,
    warehouse_allocations: normalizedAllocations,
    receiving_warehouse_id: receivingWarehouseId || null,
    purchase_invoice_id: purchaseInvoiceId,
    movement_ids: [...issueMovementIds, ...(receiptMovementId ? [receiptMovementId] : [])],
    created_at: timestamp,
    status: 'completed',
  });

  if (supplierQuantity > 0 && supplierId) {
    database.supplier_product_relations.unshift({
      id: `spr-${crypto.randomUUID()}`,
      supplier_id: supplierId,
      product_id: productId,
      variant_id: variantId,
      client_id: clientId,
      purchase_invoice_id: purchaseInvoiceId,
      quantity: supplierQuantity,
      unit_cost: unitCost,
      vat_rate: vatRate,
      total_cost: totalCost,
      warehouse_id: receivingWarehouseId || null,
      created_at: timestamp,
    });
  }

  persist(database);

  return {
    purchaseInvoiceId,
    inventoryUpdateId: database.inventory_update_records[0]?.id,
  };
}
