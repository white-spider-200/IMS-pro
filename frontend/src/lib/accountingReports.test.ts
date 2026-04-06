import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgedPayableRows,
  buildAgedReceivableRows,
  buildCashFlowRows,
  buildTaxRows,
  filterExpenses,
  filterPayments,
  filterPayableInvoices,
  filterSalesInvoices,
} from './accountingReports';

const NOW = new Date('2026-04-02T12:00:00.000Z').getTime();

const warehouses = [
  { id: 'w1', name: 'Main Warehouse' },
  { id: 'w2', name: 'Branch Warehouse' },
];

const clients = [
  { id: 'c1', name: 'Acme Corp' },
  { id: 'c2', name: 'Globex' },
];

const revenueInvoices = [
  {
    id: 'inv-current',
    invoice_number: 'INV-001',
    client_id: 'c1',
    warehouse_id: 'w1',
    created_at: '2026-04-02T09:00:00.000Z',
    total_amount: 100,
    subtotal: 90,
    vat_amount: 10,
    cogs_amount: 50,
    gross_profit: 40,
    paid_amount: 0,
    items: [{ quantity: 1 }],
    status: 'pending',
  },
  {
    id: 'inv-31',
    invoice_number: 'INV-002',
    customer_name: 'Manual Client',
    warehouse_id: 'w1',
    created_at: '2026-03-02T09:00:00.000Z',
    total_amount: 200,
    subtotal: 180,
    vat_amount: 20,
    cogs_amount: 90,
    gross_profit: 90,
    paid_amount: 20,
    items: [{ quantity: 2 }],
    status: 'partial',
  },
  {
    id: 'inv-paid',
    invoice_number: 'INV-003',
    client_id: 'c2',
    warehouse_id: 'w2',
    created_at: '2026-01-01T09:00:00.000Z',
    total_amount: 300,
    subtotal: 270,
    vat_amount: 30,
    cogs_amount: 100,
    gross_profit: 170,
    paid_amount: 300,
    items: [{ quantity: 3 }],
    status: 'paid',
  },
  {
    id: 'inv-cancelled',
    invoice_number: 'INV-004',
    client_id: 'c1',
    warehouse_id: 'w1',
    created_at: '2026-04-01T09:00:00.000Z',
    total_amount: 999,
    subtotal: 900,
    vat_amount: 99,
    cogs_amount: 200,
    gross_profit: 700,
    paid_amount: 0,
    items: [{ quantity: 1 }],
    status: 'cancelled',
  },
  {
    id: 'inv-corrupt',
    invoice_number: 'INV-005',
    client_id: 'c1',
    warehouse_id: 'w1',
    created_at: '2026-04-01T09:00:00.000Z',
    total_amount: 2_000_000_000,
    subtotal: 2_000_000_000,
    vat_amount: 0,
    cogs_amount: 0,
    gross_profit: 0,
    paid_amount: 0,
    items: [{ quantity: 1 }],
    status: 'pending',
  },
];

const purchaseInvoices = [
  {
    id: 'pay-91',
    invoice_number: 'PINV-001',
    supplier_name: 'Supplier A',
    warehouse_id: 'w1',
    created_at: '2026-01-01T09:00:00.000Z',
    total_amount: 150,
    vat_amount: 15,
    paid_amount: 50,
    items: [{ quantity: 1 }],
    status: 'pending',
  },
  {
    id: 'pay-current',
    invoice_number: 'PINV-002',
    source_name: 'Supplier B',
    warehouse_id: 'w2',
    created_at: '2026-04-02T09:00:00.000Z',
    total_amount: 100,
    vat_amount: 10,
    paid_amount: 0,
    items: [{ quantity: 1 }],
    status: 'pending',
  },
];

const clientPayments = [
  {
    id: 'cp-old',
    warehouse_id: 'w1',
    created_at: '2026-03-01T09:00:00.000Z',
    receipt_number: 'PAY-OLD',
    direction: 'incoming',
    amount: 50,
  },
  {
    id: 'cp-new',
    warehouse_id: 'w1',
    created_at: '2026-04-01T09:00:00.000Z',
    receipt_number: 'PAY-NEW',
    direction: 'incoming',
    amount: 70,
  },
];

const warehouseExpenses = [
  {
    id: 'exp-newer',
    warehouse_id: 'w1',
    created_at: '2026-04-02T10:00:00.000Z',
    title: 'Rent',
    amount: 25,
  },
  {
    id: 'exp-older',
    warehouse_id: 'w1',
    created_at: '2026-02-01T10:00:00.000Z',
    title: 'Utilities',
    amount: 15,
  },
];

test('filterSalesInvoices excludes cancelled and corrupted invoices', () => {
  const rows = filterSalesInvoices(revenueInvoices, {});
  assert.deepEqual(rows.map((row) => row.id), ['inv-current', 'inv-31', 'inv-paid']);
});

test('aged receivable rows exclude fully paid invoices and assign aging buckets', () => {
  const sales = filterSalesInvoices(revenueInvoices, {});
  const rows = buildAgedReceivableRows(sales, clients, warehouses, {}, [], NOW);

  assert.equal(rows.find((row) => row.id === 'inv-paid'), undefined);
  assert.equal(rows.find((row) => row.id === 'inv-current')?.agingBucket, 'Current');
  assert.equal(rows.find((row) => row.id === 'inv-31')?.agingBucket, '31-60');
  assert.equal(rows.find((row) => row.id === 'inv-31')?.outstanding, 180);
});

test('aged payable rows use supplier fallbacks and aging buckets', () => {
  const payables = filterPayableInvoices(purchaseInvoices, {});
  const rows = buildAgedPayableRows(payables, warehouses, {}, [], NOW);

  assert.equal(rows.find((row) => row.id === 'pay-91')?.agingBucket, '90+');
  assert.equal(rows.find((row) => row.id === 'pay-current')?.partyName, 'Supplier B');
  assert.equal(rows.find((row) => row.id === 'pay-91')?.outstanding, 100);
});

test('aged reports use payment ledger amounts when invoice paid amounts are stale', () => {
  const sales = filterSalesInvoices([
    { id: 'inv-ledger', invoice_number: 'INV-L', customer_name: 'Ledger Client', total_amount: 500, paid_amount: 0, warehouse_id: 'w1', created_at: '2026-03-01T00:00:00.000Z', status: 'pending' },
  ], {});
  const payables = filterPayableInvoices([
    { id: 'pay-ledger', invoice_number: 'PO-L', supplier_name: 'Ledger Supplier', total_cost: 300, paid_amount: 0, warehouse_id: 'w1', created_at: '2026-03-01T00:00:00.000Z', status: 'received' },
  ], {});
  const ledger = [
    { id: 'cp-in', invoice_id: 'inv-ledger', direction: 'incoming', scope: 'sale', amount: 125 },
    { id: 'cp-out', invoice_id: 'pay-ledger', direction: 'outgoing', scope: 'purchase', amount: 80 },
  ];

  const receivableRows = buildAgedReceivableRows(sales, clients, warehouses, {}, ledger, NOW);
  const payableRows = buildAgedPayableRows(payables, warehouses, {}, ledger, NOW);

  assert.equal(receivableRows[0]?.paid, 125);
  assert.equal(receivableRows[0]?.outstanding, 375);
  assert.equal(payableRows[0]?.paid, 80);
  assert.equal(payableRows[0]?.outstanding, 220);
});

test('cash flow rows sort by raw timestamp descending', () => {
  const payments = filterPayments(clientPayments, {});
  const expenses = filterExpenses(warehouseExpenses, {});
  const rows = buildCashFlowRows(payments, expenses, warehouses, {});

  assert.deepEqual(rows.map((row) => row.id), ['exp-newer', 'cp-new', 'cp-old', 'exp-older']);
});

test('tax rows aggregate output and input VAT by month', () => {
  const sales = filterSalesInvoices(revenueInvoices, {});
  const payables = filterPayableInvoices(purchaseInvoices, {});
  const rows = buildTaxRows(sales, payables, {});

  const april = rows.find((row) => row.month === '2026-04');
  const march = rows.find((row) => row.month === '2026-03');
  const january = rows.find((row) => row.month === '2026-01');

  assert.equal(april?.outputVat, 10);
  assert.equal(april?.inputVat, 10);
  assert.equal(march?.outputVat, 20);
  assert.equal(january?.inputVat, 15);
});
