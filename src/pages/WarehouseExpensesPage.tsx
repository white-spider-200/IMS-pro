import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, Coins, Repeat, ReceiptText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeDemoCollectionItem, saveDemoCollectionItem } from '../demo/demoDatabase';
import { api } from '../lib/api';

type WarehouseExpensesPageContext = {
  isDemoMode?: boolean;
  warehouses?: any[];
  warehouseExpenses?: any[];
  effectiveUser?: any;
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400';

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed appearance-none';

const textareaCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 resize-none';

const currentMonthValue = new Date().toISOString().slice(0, 7);
const currentDateValue = new Date().toISOString().slice(0, 10);

function formatMoney(amount: number, currency = 'JOD') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function formatMonthLabel(month: string) {
  if (!month) return 'N/A';
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function expenseAppliesToMonth(expense: any, month: string) {
  if (!expense || !month) return false;
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

export default function WarehouseExpensesPage() {
  const { isDemoMode, warehouses = [], warehouseExpenses = [], effectiveUser } =
    useOutletContext<WarehouseExpensesPageContext>();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'monthly' | 'one_time'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    warehouse_id: '',
    category: 'Rent',
    amount: '',
    recurrence: 'monthly',
    start_month: currentMonthValue,
    end_month: '',
    expense_date: currentDateValue,
    status: 'pending',
    payment_date: currentDateValue,
    payment_method: 'Cash',
    receipt_number: '',
    notes: '',
  });

  const visibleExpenses = useMemo(() => {
    return (warehouseExpenses || [])
      .filter((expense) => expenseAppliesToMonth(expense, selectedMonth))
      .filter((expense) => warehouseFilter === 'all' || expense.warehouse_id === warehouseFilter)
      .filter((expense) => recurrenceFilter === 'all' || expense.recurrence === recurrenceFilter)
      .filter((expense) => statusFilter === 'all' || (statusFilter === 'paid' ? expense.status === 'paid' : expense.status !== 'paid'))
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  }, [recurrenceFilter, selectedMonth, statusFilter, warehouseExpenses, warehouseFilter]);

  const summary = useMemo(() => {
    return visibleExpenses.reduce(
      (accumulator, expense) => {
        const amount = Number(expense.amount || 0);
        accumulator.total += amount;
        if (expense.recurrence === 'monthly') accumulator.monthly += amount;
        if (expense.recurrence === 'one_time') accumulator.oneTime += amount;
        if (expense.status === 'paid') accumulator.paid += amount;
        if (expense.status !== 'paid') accumulator.pending += amount;
        accumulator.warehouses.add(expense.warehouse_id);
        return accumulator;
      },
      { total: 0, monthly: 0, oneTime: 0, paid: 0, pending: 0, warehouses: new Set<string>() }
    );
  }, [visibleExpenses]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number(formData.amount);
    if (!formData.title.trim()) {
      toast.error('Expense title is required.');
      return;
    }
    if (!formData.warehouse_id) {
      toast.error('Warehouse is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Expense amount must be greater than zero.');
      return;
    }
    if (formData.recurrence === 'monthly' && !formData.start_month) {
      toast.error('Start month is required for monthly expenses.');
      return;
    }
    if (formData.recurrence === 'one_time' && !formData.expense_date) {
      toast.error('Expense date is required for one-time expenses.');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      warehouse_id: formData.warehouse_id,
      category: formData.category.trim() || 'General',
      amount,
      currency: 'JOD',
      recurrence: formData.recurrence,
      start_month: formData.recurrence === 'monthly' ? formData.start_month : formData.expense_date.slice(0, 7),
      end_month: formData.recurrence === 'monthly' ? formData.end_month || '' : '',
      expense_date: formData.recurrence === 'one_time' ? formData.expense_date : '',
      status: formData.status,
      payment_date: formData.status === 'paid' ? formData.payment_date : '',
      payment_method: formData.status === 'paid' ? formData.payment_method.trim() : '',
      receipt_number: formData.status === 'paid' ? formData.receipt_number.trim() : '',
      notes: formData.notes.trim(),
      created_at: new Date().toISOString(),
      created_by: effectiveUser?.uid || effectiveUser?.id || '',
      created_by_name: effectiveUser?.displayName || effectiveUser?.email || 'Unknown user',
    };

    setIsSaving(true);
    try {
      if (isDemoMode) {
        saveDemoCollectionItem('warehouse_expenses', payload);
      } else {
        await api.collection.create('warehouse_expenses', payload);
      }
      toast.success('Expense saved.');
      setFormData({
        title: '',
        warehouse_id: '',
        category: 'Rent',
        amount: '',
        recurrence: 'monthly',
        start_month: currentMonthValue,
        end_month: '',
        expense_date: currentDateValue,
        status: 'pending',
        payment_date: currentDateValue,
        payment_method: 'Cash',
        receipt_number: '',
        notes: '',
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (expense: any) => {
    if (!window.confirm(`Delete expense "${expense.title}"?`)) return;
    try {
      if (isDemoMode) {
        removeDemoCollectionItem('warehouse_expenses', expense.id);
      } else {
        await api.collection.remove('warehouse_expenses', expense.id);
      }
      toast.success('Expense deleted.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to delete expense');
    }
  };

  const handleMarkPaid = async (expense: any) => {
    const paymentDate = window.prompt('Payment date (YYYY-MM-DD)', currentDateValue) || '';
    if (!paymentDate.trim()) return;
    const paymentMethod = window.prompt('Payment method', expense.payment_method || 'Cash') || '';
    if (!paymentMethod.trim()) return;
    const receiptNumber = window.prompt('Receipt / invoice number (optional)', expense.receipt_number || '') || '';

    const updates = {
      ...expense,
      status: 'paid',
      payment_date: paymentDate.trim(),
      payment_method: paymentMethod.trim(),
      receipt_number: receiptNumber.trim(),
    };

    try {
      if (isDemoMode) {
        saveDemoCollectionItem('warehouse_expenses', updates);
      } else {
        await api.collection.update('warehouse_expenses', expense.id, {
          status: 'paid',
          payment_date: paymentDate.trim(),
          payment_method: paymentMethod.trim(),
          receipt_number: receiptNumber.trim(),
        });
      }
      toast.success('Expense marked as paid.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to update expense');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-8 py-6 shadow-lg shadow-slate-200">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <ReceiptText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Warehouse Expenses</h1>
            <p className="mt-0.5 text-sm text-slate-200">
              Track monthly recurring costs and one-time warehouse expenses by month.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
              <Coins className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Add Expense</h2>
              <p className="text-xs text-slate-400">Monthly recurring or one-time warehouse expense.</p>
            </div>
          </div>

          <input
            value={formData.title}
            onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
            className={inputCls}
            placeholder="Expense title"
          />

          <select
            value={formData.warehouse_id}
            onChange={(event) => setFormData((current) => ({ ...current, warehouse_id: event.target.value }))}
            className={selectCls}
          >
            <option value="">Choose warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={formData.category}
              onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
              className={inputCls}
              placeholder="Category"
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(event) => setFormData((current) => ({ ...current, amount: event.target.value }))}
              className={inputCls}
              placeholder="Amount"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <select
              value={formData.recurrence}
              onChange={(event) => setFormData((current) => ({ ...current, recurrence: event.target.value }))}
              className={selectCls}
            >
              <option value="monthly">Monthly recurring</option>
              <option value="one_time">One time</option>
            </select>

            <select
              value={formData.status}
              onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
              className={selectCls}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {formData.status === 'paid' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Payment date</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(event) => setFormData((current) => ({ ...current, payment_date: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Payment method</label>
                <input
                  value={formData.payment_method}
                  onChange={(event) => setFormData((current) => ({ ...current, payment_method: event.target.value }))}
                  className={inputCls}
                  placeholder="Cash"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Receipt number</label>
                <input
                  value={formData.receipt_number}
                  onChange={(event) => setFormData((current) => ({ ...current, receipt_number: event.target.value }))}
                  className={inputCls}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {formData.recurrence === 'monthly' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Start month</label>
                <input
                  type="month"
                  value={formData.start_month}
                  onChange={(event) => setFormData((current) => ({ ...current, start_month: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">End month</label>
                <input
                  type="month"
                  value={formData.end_month}
                  onChange={(event) => setFormData((current) => ({ ...current, end_month: event.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Expense date</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(event) => setFormData((current) => ({ ...current, expense_date: event.target.value }))}
                className={inputCls}
              />
            </div>
          )}

          <textarea
            value={formData.notes}
            onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
            className={textareaCls}
            placeholder="Optional notes"
            rows={4}
          />

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save Expense'}
          </button>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[180px]">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Month</label>
                <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className={inputCls} />
              </div>
              <div className="min-w-[220px]">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Warehouse</label>
                <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className={selectCls}>
                  <option value="all">All warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Type</label>
                <select value={recurrenceFilter} onChange={(event) => setRecurrenceFilter(event.target.value as 'all' | 'monthly' | 'one_time')} className={selectCls}>
                  <option value="all">All expenses</option>
                  <option value="monthly">Monthly recurring</option>
                  <option value="one_time">One time</option>
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Payment status</label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'paid' | 'pending')} className={selectCls}>
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Total', formatMoney(summary.total)],
                ['Monthly', formatMoney(summary.monthly)],
                ['One time', formatMoney(summary.oneTime)],
                ['Paid', formatMoney(summary.paid)],
                ['Pending', formatMoney(summary.pending)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {formatMonthLabel(selectedMonth)} across {summary.warehouses.size} warehouse{summary.warehouses.size === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Expense Records</h2>
            </div>

            {visibleExpenses.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No expenses found for the selected month and filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleExpenses.map((expense) => {
                  const warehouse = warehouses.find((entry) => entry.id === expense.warehouse_id);
                  return (
                    <div key={expense.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{expense.title}</h3>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${expense.recurrence === 'monthly' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                            {expense.recurrence === 'monthly' ? 'Monthly' : 'One time'}
                          </span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${expense.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {expense.status || 'pending'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" />{warehouse?.name || 'Unknown warehouse'}</span>
                          <span className="inline-flex items-center gap-1.5"><Coins className="h-4 w-4" />{formatMoney(Number(expense.amount || 0), expense.currency || 'JOD')}</span>
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{expense.recurrence === 'monthly' ? `From ${formatMonthLabel(expense.start_month)}` : (expense.expense_date || 'N/A')}</span>
                          {expense.recurrence === 'monthly' && expense.end_month ? <span className="inline-flex items-center gap-1.5"><Repeat className="h-4 w-4" />Until {formatMonthLabel(expense.end_month)}</span> : null}
                        </div>
                        <p className="text-sm text-slate-500">
                          {expense.category || 'General'}{expense.notes ? ` • ${expense.notes}` : ''}
                        </p>
                        {expense.status === 'paid' ? (
                          <p className="text-xs text-slate-500">
                            Paid on {expense.payment_date || 'N/A'} via {expense.payment_method || 'N/A'}{expense.receipt_number ? ` • Receipt: ${expense.receipt_number}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {expense.status !== 'paid' ? (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(expense)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Mark as Paid
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
