import { hasValidInvoiceTotals, sanitizeMoney } from './financialGuards';

export type AccountingFilters = {
  monthFilter?: string;
  warehouseFilter?: string;
  searchTerm?: string;
};

export type AgedAccountingRow = {
  id: string;
  invoiceNumber: string;
  partyName: string;
  warehouseName: string;
  issuedOn: string;
  total: number;
  paid: number;
  outstanding: number;
  ageDays: number;
  agingBucket: string;
};

export type CashFlowRow = {
  id: string;
  dateLabel: string;
  sortTime: number;
  reference: string;
  category: string;
  warehouseName: string;
  direction: 'in' | 'out';
  amount: number;
};

export type TaxRow = {
  month: string;
  outputVat: number;
  inputVat: number;
  netVat: number;
};

function parseDate(value: any) {
  if (!value) return null;
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMonthKey(value: any) {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().slice(0, 7) : '';
}

export function formatDateLabel(value: any) {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString() : 'N/A';
}

export function getDateTimeValue(value: any) {
  const parsed = parseDate(value);
  return parsed ? parsed.getTime() : 0;
}

export function formatMonthLabel(month: string) {
  if (!month) return 'All months';
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function getInvoiceTotal(invoice: any) {
  return sanitizeMoney(invoice?.total_amount ?? invoice?.total_cost ?? invoice?.subtotal ?? 0);
}

export function getInvoicePaid(invoice: any) {
  return sanitizeMoney(invoice?.paid_amount ?? 0);
}

function getLedgerPaidAmount(invoice: any, clientPayments: any[], direction: 'incoming' | 'outgoing', scope: 'sale' | 'purchase') {
  if (!invoice?.id) return 0;

  return (clientPayments || []).reduce((sum, payment) => {
    if (payment?.invoice_id !== invoice.id) return sum;
    if (payment?.direction !== direction) return sum;
    if (payment?.scope !== scope) return sum;
    return sum + sanitizeMoney(payment.amount ?? 0);
  }, 0);
}

export function getWarehouseId(record: any) {
  return record?.warehouse_id || record?.receiving_warehouse_id || '';
}

export function getWarehouseName(warehouses: any[], warehouseId: string) {
  return warehouses.find((entry) => entry.id === warehouseId)?.name || 'Unknown Warehouse';
}

export function getClientName(clients: any[], invoice: any) {
  if (invoice?.customer_name) return invoice.customer_name;
  return clients.find((entry) => entry.id === invoice?.client_id)?.name || 'Unassigned client';
}

export function getPayablePartyName(invoice: any) {
  return invoice?.supplier_name || invoice?.source_name || invoice?.customer_name || 'Unassigned supplier';
}

export function getAgeDays(value: any, now = Date.now()) {
  const issuedAt = parseDate(value);
  if (!issuedAt) return 0;
  const ageMs = now - issuedAt.getTime();
  return Math.max(Math.floor(ageMs / (1000 * 60 * 60 * 24)), 0);
}

export function getAgingBucket(ageDays: number) {
  if (ageDays <= 0) return 'Current';
  if (ageDays <= 30) return '1-30';
  if (ageDays <= 60) return '31-60';
  if (ageDays <= 90) return '61-90';
  return '90+';
}

export function matchesSearch(searchLower: string, values: unknown[]) {
  if (!searchLower) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(searchLower));
}

export function listAccountingMonths(
  revenueInvoices: any[],
  purchaseInvoices: any[],
  clientPayments: any[],
  warehouseExpenses: any[]
) {
  const months = new Set<string>();

  [...revenueInvoices, ...purchaseInvoices, ...clientPayments, ...warehouseExpenses].forEach((entry) => {
    const month = getMonthKey(entry?.created_at || entry?.expense_date || entry?.start_month);
    if (month) months.add(month);
  });

  return Array.from(months).sort((left, right) => right.localeCompare(left));
}

export function filterSalesInvoices(revenueInvoices: any[], filters: AccountingFilters) {
  const { monthFilter = '', warehouseFilter = 'all' } = filters;
  return revenueInvoices
    .filter((invoice) => invoice && invoice.status !== 'cancelled')
    .filter((invoice) => hasValidInvoiceTotals(invoice))
    .filter((invoice) => !monthFilter || getMonthKey(invoice.created_at) === monthFilter)
    .filter((invoice) => warehouseFilter === 'all' || getWarehouseId(invoice) === warehouseFilter);
}

export function filterPayableInvoices(purchaseInvoices: any[], filters: AccountingFilters) {
  const { monthFilter = '', warehouseFilter = 'all' } = filters;
  return purchaseInvoices
    .filter((invoice) => invoice && invoice.status !== 'cancelled')
    .filter((invoice) => hasValidInvoiceTotals(invoice))
    .filter((invoice) => !monthFilter || getMonthKey(invoice.created_at) === monthFilter)
    .filter((invoice) => warehouseFilter === 'all' || getWarehouseId(invoice) === warehouseFilter);
}

export function filterPayments(clientPayments: any[], filters: AccountingFilters) {
  const { monthFilter = '', warehouseFilter = 'all' } = filters;
  return clientPayments
    .filter((payment) => !monthFilter || getMonthKey(payment.created_at) === monthFilter)
    .filter((payment) => warehouseFilter === 'all' || getWarehouseId(payment) === warehouseFilter)
    .map((payment) => ({
      ...payment,
      amount: sanitizeMoney(payment.amount),
      sortTime: getDateTimeValue(payment.created_at),
    }))
    .filter((payment) => payment.amount > 0);
}

export function filterExpenses(warehouseExpenses: any[], filters: AccountingFilters) {
  const { monthFilter = '', warehouseFilter = 'all' } = filters;
  return warehouseExpenses
    .filter((expense) => !monthFilter || getMonthKey(expense.expense_date || expense.start_month || expense.created_at) === monthFilter)
    .filter((expense) => warehouseFilter === 'all' || getWarehouseId(expense) === warehouseFilter)
    .map((expense) => ({
      ...expense,
      amount: sanitizeMoney(expense.amount),
      sortTime: getDateTimeValue(expense.expense_date || expense.start_month || expense.created_at),
    }))
    .filter((expense) => expense.amount > 0);
}

export function buildProfitLossSummary(salesInvoices: any[], filteredExpenses: any[]) {
  const sales = salesInvoices.reduce((sum, invoice) => sum + sanitizeMoney(invoice.subtotal ?? invoice.total_amount), 0);
  const cogs = salesInvoices.reduce((sum, invoice) => sum + sanitizeMoney(invoice.cogs_amount), 0);
  const grossProfit = salesInvoices.reduce(
    (sum, invoice) => sum + sanitizeMoney(invoice.gross_profit ?? (sanitizeMoney(invoice.subtotal) - sanitizeMoney(invoice.cogs_amount))),
    0
  );
  const expenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    sales,
    cogs,
    grossProfit,
    expenses,
    netProfit: grossProfit - expenses,
    invoiceCount: salesInvoices.length,
  };
}

export function buildAgedReceivableRows(
  salesInvoices: any[],
  clients: any[],
  warehouses: any[],
  filters: AccountingFilters,
  clientPayments: any[] = [],
  now = Date.now()
) {
  const searchLower = String(filters.searchTerm || '').trim().toLowerCase();
  return salesInvoices
    .map((invoice) => {
      const total = getInvoiceTotal(invoice);
      const paid = Math.max(getInvoicePaid(invoice), getLedgerPaidAmount(invoice, clientPayments, 'incoming', 'sale'));
      const outstanding = Math.max(total - paid, 0);
      const ageDays = getAgeDays(invoice.created_at, now);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || invoice.id,
        partyName: getClientName(clients, invoice),
        warehouseName: getWarehouseName(warehouses, getWarehouseId(invoice)),
        issuedOn: formatDateLabel(invoice.created_at),
        total,
        paid,
        outstanding,
        ageDays,
        agingBucket: getAgingBucket(ageDays),
      } satisfies AgedAccountingRow;
    })
    .filter((row) => row.outstanding > 0)
    .filter((row) => matchesSearch(searchLower, [row.invoiceNumber, row.partyName, row.warehouseName, row.agingBucket]))
    .sort((left, right) => right.ageDays - left.ageDays || right.outstanding - left.outstanding);
}

export function buildAgedPayableRows(
  payableInvoices: any[],
  warehouses: any[],
  filters: AccountingFilters,
  clientPayments: any[] = [],
  now = Date.now()
) {
  const searchLower = String(filters.searchTerm || '').trim().toLowerCase();
  return payableInvoices
    .map((invoice) => {
      const total = getInvoiceTotal(invoice);
      const paid = Math.max(getInvoicePaid(invoice), getLedgerPaidAmount(invoice, clientPayments, 'outgoing', 'purchase'));
      const outstanding = Math.max(total - paid, 0);
      const ageDays = getAgeDays(invoice.created_at, now);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || invoice.id,
        partyName: getPayablePartyName(invoice),
        warehouseName: getWarehouseName(warehouses, getWarehouseId(invoice)),
        issuedOn: formatDateLabel(invoice.created_at),
        total,
        paid,
        outstanding,
        ageDays,
        agingBucket: getAgingBucket(ageDays),
      } satisfies AgedAccountingRow;
    })
    .filter((row) => row.outstanding > 0)
    .filter((row) => matchesSearch(searchLower, [row.invoiceNumber, row.partyName, row.warehouseName, row.agingBucket]))
    .sort((left, right) => right.ageDays - left.ageDays || right.outstanding - left.outstanding);
}

export function buildCashFlowRows(filteredPayments: any[], filteredExpenses: any[], warehouses: any[], filters: AccountingFilters) {
  const searchLower = String(filters.searchTerm || '').trim().toLowerCase();

  const paymentRows = filteredPayments
    .map((payment) => ({
      id: payment.id,
      dateLabel: formatDateLabel(payment.created_at),
      sortTime: payment.sortTime,
      reference: payment.receipt_number || payment.invoice_number || payment.id,
      category: payment.direction === 'incoming' ? 'Client receipt' : 'Outgoing customer payment',
      warehouseName: getWarehouseName(warehouses, getWarehouseId(payment)),
      direction: payment.direction === 'incoming' ? 'in' as const : 'out' as const,
      amount: payment.amount,
    }))
    .filter((row) => matchesSearch(searchLower, [row.reference, row.category, row.warehouseName]));

  const expenseRows = filteredExpenses
    .map((expense) => ({
      id: expense.id,
      dateLabel: formatDateLabel(expense.expense_date || expense.start_month || expense.created_at),
      sortTime: expense.sortTime,
      reference: expense.title || expense.id,
      category: 'Warehouse expense',
      warehouseName: getWarehouseName(warehouses, getWarehouseId(expense)),
      direction: 'out' as const,
      amount: expense.amount,
    }))
    .filter((row) => matchesSearch(searchLower, [row.reference, row.category, row.warehouseName]));

  return [...paymentRows, ...expenseRows].sort((left, right) => right.sortTime - left.sortTime);
}

export function summarizeCashFlow(cashFlowRows: CashFlowRow[]) {
  const incoming = cashFlowRows.filter((row) => row.direction === 'in').reduce((sum, row) => sum + row.amount, 0);
  const outgoing = cashFlowRows.filter((row) => row.direction === 'out').reduce((sum, row) => sum + row.amount, 0);

  return {
    incoming,
    outgoing,
    net: incoming - outgoing,
    movementCount: cashFlowRows.length,
  };
}

export function buildTaxRows(salesInvoices: any[], payableInvoices: any[], filters: AccountingFilters) {
  const searchLower = String(filters.searchTerm || '').trim().toLowerCase();
  const monthMap = new Map<string, { month: string; outputVat: number; inputVat: number }>();

  salesInvoices.forEach((invoice) => {
    const month = getMonthKey(invoice.created_at) || 'Unknown';
    const current = monthMap.get(month) || { month, outputVat: 0, inputVat: 0 };
    current.outputVat += sanitizeMoney(invoice.vat_amount);
    monthMap.set(month, current);
  });

  payableInvoices.forEach((invoice) => {
    const month = getMonthKey(invoice.created_at) || 'Unknown';
    const current = monthMap.get(month) || { month, outputVat: 0, inputVat: 0 };
    current.inputVat += sanitizeMoney(invoice.vat_amount);
    monthMap.set(month, current);
  });

  return Array.from(monthMap.values())
    .map((row) => ({ ...row, netVat: row.outputVat - row.inputVat }))
    .filter((row) => matchesSearch(searchLower, [formatMonthLabel(row.month)]))
    .sort((left, right) => right.month.localeCompare(left.month));
}

export function summarizeTaxRows(taxRows: TaxRow[]) {
  const outputVat = taxRows.reduce((sum, row) => sum + row.outputVat, 0);
  const inputVat = taxRows.reduce((sum, row) => sum + row.inputVat, 0);

  return {
    outputVat,
    inputVat,
    netVat: outputVat - inputVat,
    periodCount: taxRows.length,
  };
}
