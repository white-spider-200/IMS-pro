import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Building2, Coins, Search, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

type OutletContext = {
  revenueInvoices?: any[];
  warehouses?: any[];
  warehouseExpenses?: any[];
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400';

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 appearance-none';

const MAX_REPORT_QUANTITY = 1_000_000;
const MAX_REPORT_MONEY = 1_000_000_000;

function toMoney(value: number, currency = 'JOD') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isFiniteInRange(value: unknown, maxValue: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= maxValue;
}

function formatMonthLabel(month: string) {
  if (!month) return 'All months';
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function expenseAppliesToMonth(expense: any, month: string) {
  if (!expense) return false;
  if (!month) return true;

  if (expense.recurrence === 'monthly') {
    const startMonth = String(expense.start_month || '').slice(0, 7);
    const endMonth = String(expense.end_month || '').slice(0, 7);
    if (!startMonth) return false;
    if (startMonth > month) return false;
    if (endMonth && endMonth < month) return false;
    return true;
  }

  const expenseMonth = String(expense.expense_date || expense.start_month || expense.created_at || '').slice(0, 7);
  return expenseMonth === month;
}

export default function NetProfitPage() {
  const { revenueInvoices = [], warehouses = [], warehouseExpenses = [] } = useOutletContext<OutletContext>();

  const [monthFilter, setMonthFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const availableMonths = useMemo(() => {
    const values = new Set<string>();

    (revenueInvoices || []).forEach((invoice) => {
      const month = String(invoice?.created_at || '').slice(0, 7);
      if (month) values.add(month);
    });

    (warehouseExpenses || []).forEach((expense) => {
      const singleMonth = String(expense?.expense_date || expense?.created_at || '').slice(0, 7);
      const startMonth = String(expense?.start_month || '').slice(0, 7);
      const endMonth = String(expense?.end_month || '').slice(0, 7);

      if (expense?.recurrence === 'monthly' && startMonth) {
        const startDate = new Date(`${startMonth}-01T00:00:00`);
        const endDate = endMonth ? new Date(`${endMonth}-01T00:00:00`) : null;

        if (!Number.isNaN(startDate.getTime())) {
          const cursor = new Date(startDate);
          let guard = 0;
          while (guard < 120) {
            const month = cursor.toISOString().slice(0, 7);
            values.add(month);
            if (endDate && cursor >= endDate) break;
            if (!endDate && month === new Date().toISOString().slice(0, 7)) break;
            cursor.setMonth(cursor.getMonth() + 1);
            guard += 1;
          }
        }
      } else if (singleMonth) {
        values.add(singleMonth);
      }
    });

    return Array.from(values).sort((left, right) => right.localeCompare(left));
  }, [revenueInvoices, warehouseExpenses]);

  const invoiceRows = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    return (revenueInvoices || [])
      .filter((invoice) => invoice && invoice.status !== 'cancelled')
      .filter((invoice) => invoice.gross_profit !== undefined || invoice.cogs_amount !== undefined)
      .filter((invoice) => !monthFilter || String(invoice.created_at || '').slice(0, 7) === monthFilter)
      .filter((invoice) => warehouseFilter === 'all' || invoice.warehouse_id === warehouseFilter)
      .map((invoice) => {
        const warehouse = warehouses.find((entry) => entry.id === invoice.warehouse_id);
        const quantity = Array.isArray(invoice.items)
          ? invoice.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
          : 0;

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number || invoice.id,
          customerName: invoice.customer_name || 'N/A',
          warehouseId: invoice.warehouse_id,
          warehouseName: warehouse?.name || 'Unknown Warehouse',
          sales: Number(invoice.subtotal ?? invoice.total_amount ?? 0),
          cogs: Number(invoice.cogs_amount || 0),
          grossProfit: Number(invoice.gross_profit || 0),
          quantity,
          createdAt: invoice.created_at || '',
        };
      })
      .filter((row) =>
        isFiniteInRange(row.quantity, MAX_REPORT_QUANTITY)
        && isFiniteInRange(row.sales, MAX_REPORT_MONEY)
        && isFiniteInRange(row.cogs, MAX_REPORT_MONEY)
        && isFiniteInRange(row.grossProfit, MAX_REPORT_MONEY)
      )
      .filter((row) => {
        if (!searchLower) return true;
        return [row.invoiceNumber, row.customerName, row.warehouseName]
          .some((value) => String(value || '').toLowerCase().includes(searchLower));
      })
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }, [monthFilter, revenueInvoices, searchTerm, warehouseFilter, warehouses]);

  const expenseRows = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    return (warehouseExpenses || [])
      .filter((expense) => expenseAppliesToMonth(expense, monthFilter))
      .filter((expense) => warehouseFilter === 'all' || expense.warehouse_id === warehouseFilter)
      .map((expense) => {
        const warehouse = warehouses.find((entry) => entry.id === expense.warehouse_id);
        return {
          id: expense.id,
          title: expense.title || 'Untitled expense',
          warehouseId: expense.warehouse_id,
          warehouseName: warehouse?.name || 'Unknown Warehouse',
          category: expense.category || 'General',
          amount: Number(expense.amount || 0),
          recurrence: expense.recurrence || 'one_time',
          status: expense.status || 'pending',
          expenseDate: expense.expense_date || expense.start_month || expense.created_at || '',
        };
      })
      .filter((row) => {
        if (!searchLower) return true;
        return [row.title, row.warehouseName, row.category]
          .some((value) => String(value || '').toLowerCase().includes(searchLower));
      })
      .sort((left, right) => new Date(right.expenseDate || 0).getTime() - new Date(left.expenseDate || 0).getTime());
  }, [monthFilter, searchTerm, warehouseExpenses, warehouseFilter, warehouses]);

  const summary = useMemo(() => {
    const grossProfit = invoiceRows.reduce((sum, row) => sum + row.grossProfit, 0);
    const sales = invoiceRows.reduce((sum, row) => sum + row.sales, 0);
    const cogs = invoiceRows.reduce((sum, row) => sum + row.cogs, 0);
    const expenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);
    const netProfit = grossProfit - expenses;

    return {
      sales,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      invoiceCount: invoiceRows.length,
      expenseCount: expenseRows.length,
    };
  }, [expenseRows, invoiceRows]);

  const warehouseBreakdown = useMemo(() => {
    const targetWarehouses = warehouseFilter === 'all'
      ? warehouses
      : warehouses.filter((warehouse) => warehouse.id === warehouseFilter);

    return targetWarehouses
      .map((warehouse) => {
        const warehouseGrossProfit = invoiceRows
          .filter((row) => row.warehouseId === warehouse.id)
          .reduce((sum, row) => sum + row.grossProfit, 0);
        const warehouseExpensesTotal = expenseRows
          .filter((row) => row.warehouseId === warehouse.id)
          .reduce((sum, row) => sum + row.amount, 0);

        return {
          id: warehouse.id,
          name: warehouse.name,
          grossProfit: warehouseGrossProfit,
          expenses: warehouseExpensesTotal,
          netProfit: warehouseGrossProfit - warehouseExpensesTotal,
        };
      })
      .filter((row) => row.grossProfit !== 0 || row.expenses !== 0)
      .sort((left, right) => right.netProfit - left.netProfit);
  }, [expenseRows, invoiceRows, warehouseFilter, warehouses]);

  const hasAnyProfitInvoices = useMemo(
    () => (revenueInvoices || []).some((invoice) => invoice && invoice.status !== 'cancelled' && Number(invoice.gross_profit || 0) !== 0),
    [revenueInvoices]
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-700 via-cyan-600 to-emerald-600 px-8 py-6 shadow-lg shadow-cyan-200">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Pure Profit Report</h1>
            <p className="mt-0.5 text-sm text-cyan-50">
              Gross profit after warehouse expenses, with warehouse-specific filtering.
            </p>
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
                placeholder="Warehouse, invoice, expense..."
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing {formatMonthLabel(monthFilter)} for {warehouseFilter === 'all'
            ? 'all warehouses'
            : (warehouses.find((warehouse) => warehouse.id === warehouseFilter)?.name || 'selected warehouse')}.
          </p>
          <button
            type="button"
            onClick={() => {
              setMonthFilter('');
              setWarehouseFilter('all');
              setSearchTerm('');
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
        {invoiceRows.length === 0 && hasAnyProfitInvoices ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No profit invoices match the current filters. Try clearing the month filter to show all recorded profit.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Net Sales',
            amount: summary.sales,
            icon: TrendingUp,
            accent: 'text-indigo-600 bg-indigo-50',
            cardClass: 'border-slate-100 bg-white',
            valueClass: 'text-slate-900',
            currencyClass: 'text-slate-500',
          },
          {
            label: 'COGS',
            amount: summary.cogs,
            icon: Coins,
            accent: 'text-amber-600 bg-amber-50',
            cardClass: 'border-slate-100 bg-white',
            valueClass: 'text-slate-900',
            currencyClass: 'text-slate-500',
          },
          {
            label: 'Gross Profit',
            amount: summary.grossProfit,
            icon: BarChart3,
            accent: 'text-emerald-600 bg-emerald-50',
            cardClass: 'border-slate-100 bg-white',
            valueClass: 'text-slate-900',
            currencyClass: 'text-slate-500',
          },
          {
            label: 'Expenses',
            amount: summary.expenses,
            icon: Wallet,
            accent: 'text-rose-600 bg-rose-50',
            cardClass: 'border-slate-100 bg-white',
            valueClass: 'text-slate-900',
            currencyClass: 'text-slate-500',
          },
          {
            label: 'Pure Profit',
            amount: summary.netProfit,
            icon: TrendingDown,
            accent: summary.netProfit >= 0 ? 'text-cyan-700 bg-white/15' : 'text-rose-100 bg-white/10',
            cardClass: summary.netProfit >= 0
              ? 'border-cyan-200 bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700'
              : 'border-rose-200 bg-gradient-to-br from-rose-700 via-rose-600 to-orange-500',
            valueClass: 'text-white',
            currencyClass: 'text-white/70',
          },
        ].map((card) => (
          <div key={card.label} className={`overflow-hidden rounded-2xl border p-5 shadow-sm ${card.cardClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.24em] ${card.label === 'Pure Profit' ? 'text-white/70' : 'text-slate-400'}`}>
                  {card.label}
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`text-sm font-semibold uppercase tracking-[0.2em] ${card.currencyClass}`}>JOD</span>
                  <span className={`text-4xl font-black leading-none tracking-tight tabular-nums ${card.valueClass}`}>
                    {formatAmount(card.amount)}
                  </span>
                </div>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Warehouse Breakdown</h2>
              <p className="text-xs text-slate-400">Gross profit minus expenses for each warehouse.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {warehouseBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No warehouse profit data found for these filters.
              </div>
            ) : (
              warehouseBreakdown.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Gross profit</span>
                      <span className="font-semibold">{toMoney(row.grossProfit)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Expenses</span>
                      <span className="font-semibold">{toMoney(row.expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold">
                      <span className="text-slate-900">Pure profit</span>
                      <span className={row.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{toMoney(row.netProfit)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Profit Source Invoices</h2>
              <p className="mt-1 text-xs text-slate-400">{summary.invoiceCount} invoice{summary.invoiceCount === 1 ? '' : 's'} included in gross profit.</p>
            </div>
            {invoiceRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No sell invoices with gross profit found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Invoice</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Warehouse</th>
                      <th className="px-6 py-4 text-right">Qty</th>
                      <th className="px-6 py-4 text-right">Sales</th>
                      <th className="px-6 py-4 text-right">COGS</th>
                      <th className="px-6 py-4 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{row.invoiceNumber}</p>
                          <p className="text-xs text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleString() : 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.customerName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-700">{row.quantity.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-indigo-700">{toMoney(row.sales)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-amber-700">{toMoney(row.cogs)}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-700">{toMoney(row.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Expense Deductions</h2>
              <p className="mt-1 text-xs text-slate-400">{summary.expenseCount} expense{summary.expenseCount === 1 ? '' : 's'} deducted from gross profit.</p>
            </div>
            {expenseRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No warehouse expenses found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Expense</th>
                      <th className="px-6 py-4">Warehouse</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenseRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{row.title}</p>
                          <p className="text-xs text-slate-500">{row.category}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                        <td className="px-6 py-4 text-slate-700">{row.recurrence === 'monthly' ? 'Monthly' : 'One time'}</td>
                        <td className="px-6 py-4 text-slate-700">{row.status}</td>
                        <td className="px-6 py-4 text-slate-700">{row.expenseDate ? new Date(row.expenseDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-700">{toMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
