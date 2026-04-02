import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Package, Search, TrendingUp, Warehouse as WarehouseIcon } from 'lucide-react';

type OutletContext = {
  revenueInvoices?: any[];
  products?: any[];
  variants?: any[];
  warehouses?: any[];
  clients?: any[];
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400';

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 appearance-none';

function toMoney(value: number) {
  return `$${Number(value || 0).toLocaleString()}`;
}

export default function CogsReportPage() {
  const { revenueInvoices = [], products = [], variants = [], warehouses = [], clients = [] } =
    useOutletContext<OutletContext>();

  const [monthFilter, setMonthFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getVariant = (variantId: string) => variants.find((entry) => entry.id === variantId);
  const getProduct = (variantId: string) => {
    const variant = getVariant(variantId);
    return products.find((entry) => entry.id === variant?.product_id);
  };

  const rows = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    return (revenueInvoices || [])
      .filter((invoice) => invoice && invoice.status !== 'cancelled')
      .filter((invoice) => invoice.cogs_amount !== undefined || invoice.gross_profit !== undefined || invoice.cost_per_unit_at_sale !== undefined)
      .filter((invoice) => !monthFilter || String(invoice.created_at || '').slice(0, 7) === monthFilter)
      .filter((invoice) => warehouseFilter === 'all' || invoice.warehouse_id === warehouseFilter)
      .map((invoice) => {
        const item = Array.isArray(invoice.items) ? invoice.items[0] : null;
        const variantId = item?.variant_id || '';
        const variant = getVariant(variantId);
        const product = getProduct(variantId);
        const client = clients.find((entry) => entry.id === invoice.client_id);
        const warehouse = warehouses.find((entry) => entry.id === invoice.warehouse_id);
        const quantity = Array.isArray(invoice.items)
          ? invoice.items.reduce((sum: number, entry: any) => sum + Number(entry.quantity || 0), 0)
          : 0;

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number || invoice.id,
          date: invoice.created_at ? new Date(invoice.created_at).toLocaleString() : 'N/A',
          month: String(invoice.created_at || '').slice(0, 7),
          customerName: invoice.customer_name || client?.name || 'N/A',
          warehouseName: warehouse?.name || 'Unknown Warehouse',
          productName: product?.name || 'Unknown Product',
          variantLabel: variant ? (variant.variant_code || variant.barcode || variant.id) : 'N/A',
          quantity,
          sales: Number(invoice.subtotal ?? invoice.total_amount ?? 0),
          cogs: Number(invoice.cogs_amount || 0),
          grossProfit: Number(invoice.gross_profit || 0),
          costPerUnit: Number(invoice.cost_per_unit_at_sale || 0),
        };
      })
      .filter((row) => {
        if (!searchLower) return true;
        return [
          row.invoiceNumber,
          row.customerName,
          row.warehouseName,
          row.productName,
          row.variantLabel,
        ].some((value) => String(value || '').toLowerCase().includes(searchLower));
      })
      .sort((left, right) => new Date(right.month || 0).getTime() - new Date(left.month || 0).getTime());
  }, [clients, monthFilter, products, revenueInvoices, searchTerm, variants, warehouseFilter, warehouses]);

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.sales += row.sales;
        accumulator.cogs += row.cogs;
        accumulator.grossProfit += row.grossProfit;
        accumulator.quantity += row.quantity;
        return accumulator;
      },
      { sales: 0, cogs: 0, grossProfit: 0, quantity: 0 }
    );
  }, [rows]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-8 py-6 shadow-lg shadow-emerald-200">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">COGS Report</h1>
            <p className="mt-0.5 text-sm text-emerald-50">
              Review saved cost of goods sold and gross profit for sell invoices.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Month</label>
            <input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className={inputCls} />
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
                placeholder="Invoice, customer, product..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Net Sales', value: toMoney(summary.sales), icon: TrendingUp, accent: 'text-indigo-600 bg-indigo-50' },
          { label: 'COGS', value: toMoney(summary.cogs), icon: Package, accent: 'text-amber-600 bg-amber-50' },
          { label: 'Gross Profit', value: toMoney(summary.grossProfit), icon: BarChart3, accent: 'text-emerald-600 bg-emerald-50' },
          { label: 'Units Sold', value: summary.quantity.toLocaleString(), icon: WarehouseIcon, accent: 'text-slate-700 bg-slate-100' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{card.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Sell Invoices with COGS</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No sell invoices with saved COGS found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4">Invoice</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Warehouse</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Sales</th>
                  <th className="px-6 py-4 text-right">Cost / Unit</th>
                  <th className="px-6 py-4 text-right">COGS</th>
                  <th className="px-6 py-4 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{row.invoiceNumber}</p>
                      <p className="text-xs text-slate-500">{row.date}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{row.customerName}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{row.productName}</p>
                      <p className="text-xs text-slate-500">{row.variantLabel}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{row.warehouseName}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">{row.quantity.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold text-indigo-700">{toMoney(row.sales)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">{toMoney(row.costPerUnit)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-amber-700">{toMoney(row.cogs)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-700">{toMoney(row.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
