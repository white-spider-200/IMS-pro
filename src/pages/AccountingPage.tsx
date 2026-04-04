import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Calculator,
  Landmark,
  ReceiptText,
  Search,
  Wallet,
} from 'lucide-react';
import {
  buildAgedPayableRows,
  buildAgedReceivableRows,
  buildCashFlowRows,
  buildProfitLossSummary,
  buildTaxRows,
  filterExpenses,
  filterPayments,
  filterPayableInvoices,
  filterSalesInvoices,
  formatMonthLabel,
  listAccountingMonths,
  summarizeCashFlow,
  summarizeTaxRows,
} from '../lib/accountingReports';
import { sanitizeMoney } from '../lib/financialGuards';

type AccountingReportType =
  | 'profit-loss'
  | 'aged-receivable'
  | 'aged-payable'
  | 'cash-flow'
  | 'tax-report';

type AccountingPageProps = {
  reportType: AccountingReportType;
};

type OutletContext = {
  revenueInvoices?: any[];
  purchaseInvoices?: any[];
  clientPayments?: any[];
  warehouseExpenses?: any[];
  warehouses?: any[];
  clients?: any[];
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400';

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 appearance-none';

function toMoney(value: number, currency = 'JOD') {
  return `${currency} ${sanitizeMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SummaryCard({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-6 py-12 text-center text-sm text-slate-500">{message}</div>;
}

export default function AccountingPage({ reportType }: AccountingPageProps) {
  const {
    revenueInvoices = [],
    purchaseInvoices = [],
    clientPayments = [],
    warehouseExpenses = [],
    warehouses = [],
    clients = [],
  } = useOutletContext<OutletContext>();

  const [monthFilter, setMonthFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filters = useMemo(
    () => ({
      monthFilter,
      warehouseFilter,
      searchTerm,
    }),
    [monthFilter, searchTerm, warehouseFilter]
  );

  const availableMonths = useMemo(
    () => listAccountingMonths(revenueInvoices, purchaseInvoices, clientPayments, warehouseExpenses),
    [clientPayments, purchaseInvoices, revenueInvoices, warehouseExpenses]
  );

  const salesInvoices = useMemo(() => filterSalesInvoices(revenueInvoices, filters), [filters, revenueInvoices]);
  const payableInvoices = useMemo(() => filterPayableInvoices(purchaseInvoices, filters), [filters, purchaseInvoices]);
  const filteredPayments = useMemo(() => filterPayments(clientPayments, filters), [clientPayments, filters]);
  const filteredExpenses = useMemo(() => filterExpenses(warehouseExpenses, filters), [filters, warehouseExpenses]);

  const profitLossSummary = useMemo(
    () => buildProfitLossSummary(salesInvoices, filteredExpenses),
    [filteredExpenses, salesInvoices]
  );
  const receivableRows = useMemo(
    () => buildAgedReceivableRows(salesInvoices, clients, warehouses, filters, clientPayments),
    [clientPayments, clients, filters, salesInvoices, warehouses]
  );
  const payableRows = useMemo(
    () => buildAgedPayableRows(payableInvoices, warehouses, filters, clientPayments),
    [clientPayments, filters, payableInvoices, warehouses]
  );
  const cashFlowRows = useMemo(
    () => buildCashFlowRows(filteredPayments, filteredExpenses, warehouses, filters),
    [filteredExpenses, filteredPayments, filters, warehouses]
  );
  const cashFlowSummary = useMemo(() => summarizeCashFlow(cashFlowRows), [cashFlowRows]);
  const taxRows = useMemo(() => buildTaxRows(salesInvoices, payableInvoices, filters), [filters, payableInvoices, salesInvoices]);
  const taxSummary = useMemo(() => summarizeTaxRows(taxRows), [taxRows]);
  const closedReceivableCount = Math.max(salesInvoices.length - receivableRows.length, 0);
  const closedPayableCount = Math.max(payableInvoices.length - payableRows.length, 0);

  const hero = {
    'profit-loss': {
      title: 'Profit & Loss',
      description: 'Revenue, COGS, gross profit, and warehouse expenses for the selected accounting period.',
      icon: BriefcaseBusiness,
      background: 'from-sky-700 via-blue-600 to-indigo-600',
    },
    'aged-receivable': {
      title: 'Aged Receivable',
      description: 'Open customer invoices grouped by overdue age based on each invoice issue date.',
      icon: Landmark,
      background: 'from-emerald-700 via-emerald-600 to-teal-600',
    },
    'aged-payable': {
      title: 'Aged Payable',
      description: 'Outstanding purchase invoices grouped by overdue age for supplier-side obligations.',
      icon: ReceiptText,
      background: 'from-amber-700 via-orange-600 to-rose-600',
    },
    'cash-flow': {
      title: 'Cash Flow',
      description: 'Recorded cash movements only: incoming client payments and outgoing warehouse expenses.',
      icon: Wallet,
      background: 'from-violet-700 via-fuchsia-600 to-pink-600',
    },
    'tax-report': {
      title: 'Tax Report',
      description: 'VAT collected on sales versus VAT paid on purchases, summarized by accounting month.',
      icon: Calculator,
      background: 'from-cyan-700 via-sky-600 to-blue-600',
    },
  }[reportType];

  const HeroIcon = hero.icon;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-1">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${hero.background} px-8 py-6 shadow-lg`}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <HeroIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{hero.title}</h1>
            <p className="mt-0.5 max-w-3xl text-sm text-white/85">{hero.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Month</label>
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className={selectCls}>
              <option value="">All months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>{formatMonthLabel(month)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Warehouse</label>
            <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className={selectCls}>
              <option value="all">All warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`${inputCls} pl-10`}
                placeholder="Search report records..."
              />
            </div>
          </div>
        </div>
      </div>

      {reportType === 'profit-loss' ? (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <SummaryCard label="Sales" value={toMoney(profitLossSummary.sales)} tone="text-sky-700" />
            <SummaryCard label="COGS" value={toMoney(profitLossSummary.cogs)} tone="text-amber-700" />
            <SummaryCard label="Gross Profit" value={toMoney(profitLossSummary.grossProfit)} tone="text-emerald-700" />
            <SummaryCard label="Warehouse Expenses" value={toMoney(profitLossSummary.expenses)} tone="text-rose-700" />
            <SummaryCard label="Net Profit" value={toMoney(profitLossSummary.netProfit)} tone="text-violet-700" />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Period Snapshot</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Recorded Sell Invoices</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{profitLossSummary.invoiceCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Net Result</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{toMoney(profitLossSummary.netProfit)}</p>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {reportType === 'aged-receivable' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Outstanding Balance" value={toMoney(receivableRows.reduce((sum, row) => sum + row.outstanding, 0))} tone="text-amber-700" />
            <SummaryCard label="Open Invoices" value={receivableRows.length.toLocaleString()} />
            <SummaryCard label="Customers With Balance" value={new Set(receivableRows.map((row) => row.partyName)).size.toLocaleString()} />
            <SummaryCard label="Over 90 Days" value={toMoney(receivableRows.filter((row) => row.agingBucket === '90+').reduce((sum, row) => sum + row.outstanding, 0))} tone="text-rose-700" />
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            This report only shows unpaid or partially paid sell invoices.
            {` Matching sell invoices: ${salesInvoices.length}. Open invoices: ${receivableRows.length}. Fully paid or zero-balance invoices: ${closedReceivableCount}.`}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Open Customer Invoices</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Invoice', 'Customer', 'Warehouse', 'Issued', 'Age', 'Bucket', 'Outstanding'].map((heading) => (
                      <th key={heading} className="px-6 py-4 text-left font-bold uppercase tracking-widest text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receivableRows.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState message="No outstanding receivables found for the selected filters. If the customer already paid the full amount, that invoice will not appear here." /></td></tr>
                  ) : (
                    receivableRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-6 py-4 font-semibold text-slate-900">{row.invoiceNumber}</td>
                        <td className="px-6 py-4 text-slate-700">{row.partyName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.issuedOn}</td>
                        <td className="px-6 py-4 text-slate-700">{row.ageDays}d</td>
                        <td className="px-6 py-4 text-slate-700">{row.agingBucket}</td>
                        <td className="px-6 py-4 text-right font-bold text-amber-700">{toMoney(row.outstanding)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {reportType === 'aged-payable' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Outstanding Payables" value={toMoney(payableRows.reduce((sum, row) => sum + row.outstanding, 0))} tone="text-rose-700" />
            <SummaryCard label="Open Purchase Invoices" value={payableRows.length.toLocaleString()} />
            <SummaryCard label="Suppliers / Sources" value={new Set(payableRows.map((row) => row.partyName)).size.toLocaleString()} />
            <SummaryCard label="Over 90 Days" value={toMoney(payableRows.filter((row) => row.agingBucket === '90+').reduce((sum, row) => sum + row.outstanding, 0))} tone="text-amber-700" />
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            This report only shows unpaid or partially paid buy invoices.
            {` Matching buy invoices: ${payableInvoices.length}. Open invoices: ${payableRows.length}. Fully paid or zero-balance invoices: ${closedPayableCount}.`}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Outstanding Purchase Invoices</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Invoice', 'Supplier / Source', 'Warehouse', 'Issued', 'Age', 'Bucket', 'Outstanding'].map((heading) => (
                      <th key={heading} className="px-6 py-4 text-left font-bold uppercase tracking-widest text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payableRows.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState message="No outstanding payables found for the selected filters. If you already paid the full amount, that invoice will not appear here." /></td></tr>
                  ) : (
                    payableRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-6 py-4 font-semibold text-slate-900">{row.invoiceNumber}</td>
                        <td className="px-6 py-4 text-slate-700">{row.partyName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.issuedOn}</td>
                        <td className="px-6 py-4 text-slate-700">{row.ageDays}d</td>
                        <td className="px-6 py-4 text-slate-700">{row.agingBucket}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-700">{toMoney(row.outstanding)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {reportType === 'cash-flow' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Cash In" value={toMoney(cashFlowSummary.incoming)} tone="text-emerald-700" />
            <SummaryCard label="Cash Out" value={toMoney(cashFlowSummary.outgoing)} tone="text-rose-700" />
            <SummaryCard label="Net Cash Movement" value={toMoney(cashFlowSummary.net)} />
            <SummaryCard label="Recorded Movements" value={cashFlowSummary.movementCount.toLocaleString()} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Recorded Cash Movements</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Date', 'Reference', 'Category', 'Warehouse', 'Direction', 'Amount'].map((heading) => (
                      <th key={heading} className="px-6 py-4 text-left font-bold uppercase tracking-widest text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashFlowRows.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState message="No cash movements found for the selected filters." /></td></tr>
                  ) : (
                    cashFlowRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-6 py-4 text-slate-700">{row.dateLabel}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{row.reference}</td>
                        <td className="px-6 py-4 text-slate-700">{row.category}</td>
                        <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.direction === 'in' ? 'Inflow' : 'Outflow'}</td>
                        <td className={`px-6 py-4 text-right font-bold ${row.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {toMoney(row.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {reportType === 'tax-report' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Output VAT" value={toMoney(taxSummary.outputVat)} tone="text-sky-700" />
            <SummaryCard label="Input VAT" value={toMoney(taxSummary.inputVat)} tone="text-emerald-700" />
            <SummaryCard label="Net VAT Due / Recoverable" value={toMoney(taxSummary.netVat)} />
            <SummaryCard label="Reported Periods" value={taxSummary.periodCount.toLocaleString()} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">VAT by Accounting Month</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Period', 'Output VAT', 'Input VAT', 'Net VAT'].map((heading) => (
                      <th key={heading} className="px-6 py-4 text-left font-bold uppercase tracking-widest text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxRows.length === 0 ? (
                    <tr><td colSpan={4}><EmptyState message="No VAT records found for the selected filters." /></td></tr>
                  ) : (
                    taxRows.map((row) => (
                      <tr key={row.month}>
                        <td className="px-6 py-4 font-semibold text-slate-900">{formatMonthLabel(row.month)}</td>
                        <td className="px-6 py-4 text-right text-sky-700">{toMoney(row.outputVat)}</td>
                        <td className="px-6 py-4 text-right text-emerald-700">{toMoney(row.inputVat)}</td>
                        <td className={`px-6 py-4 text-right font-bold ${row.netVat >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {toMoney(row.netVat)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
