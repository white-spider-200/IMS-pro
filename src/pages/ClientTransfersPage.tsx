import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, FileSpreadsheet, FileText, Receipt, X } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { calculateClientFinancials } from '../lib/clientFinancials';
import { exportRowsToExcel, exportTextLinesToPdf } from '../lib/fileExports';

type OutletContext = {
  clients?: any[];
  warehouses?: any[];
  transfers?: any[];
  revenueInvoices?: any[];
  purchaseInvoices?: any[];
  clientPayments?: any[];
  variants?: any[];
  products?: any[];
};

type ClientTransferRow = {
  id: string;
  transferId: string;
  invoiceNumber: string;
  createdAt: string;
  date: string;
  warehouse: string;
  type: string;
  quantity: number;
  totalAmount: number;
  status: string;
  items: string;
  customerName: string;
  invoiceKind: 'sale' | 'purchase';
  invoice: any;
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-right text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export default function ClientTransfersPage() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [selectedTransfer, setSelectedTransfer] = useState<ClientTransferRow | null>(null);
  const {
    clients = [],
    warehouses = [],
    transfers = [],
    revenueInvoices = [],
    purchaseInvoices = [],
    clientPayments = [],
    variants = [],
    products = [],
  } = useOutletContext<OutletContext>();

  const client = useMemo(
    () => clients.find((entry) => entry.id === clientId) || null,
    [clientId, clients]
  );

  const getWarehouseName = (warehouseId: string) =>
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || 'Unknown Warehouse';

  const getVariantLabel = (variantId: string) => {
    const variant = variants.find((entry) => entry.id === variantId);
    if (!variant) return variantId || 'N/A';
    const product = products.find((entry) => entry.id === variant.product_id);
    return `${product?.name || 'Unknown Product'} / ${variant.variant_code || variant.barcode || variantId}`;
  };

  const transferRows = useMemo<ClientTransferRow[]>(() => {
    if (!client) return [];

    return transfers
      .filter((transfer) => {
        if (!['buy', 'sell', 'buy_order'].includes(String(transfer.transfer_type || ''))) return false;
        if (transfer.client_id && transfer.client_id === client.id) return true;
        return String(transfer.customer_name || '').trim().toLowerCase() === String(client.name || '').trim().toLowerCase();
      })
      .map((transfer) => {
        const isSell = transfer.transfer_type === 'sell';
        const invoice = isSell
          ? revenueInvoices.find((entry) => entry.id === transfer.revenue_invoice_id) || null
          : purchaseInvoices.find((entry) => entry.id === transfer.purchase_invoice_id) || null;
        const quantity = Number(
          transfer.quantity
          ?? invoice?.quantity_purchased
          ?? invoice?.requested_quantity
          ?? (Array.isArray(invoice?.items) ? invoice.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) : 0)
          ?? 0
        );
        const itemSummary = isSell
          ? (Array.isArray(invoice?.items)
              ? invoice.items.map((item: any) => getVariantLabel(item.variant_id)).join(', ')
              : getVariantLabel(transfer.product_variant_id))
          : getVariantLabel(transfer.product_variant_id || invoice?.product_variant_id);
        return {
          id: transfer.id,
          transferId: transfer.transfer_number || transfer.id,
          invoiceNumber: invoice?.invoice_number || 'N/A',
          createdAt: transfer.created_at || invoice?.created_at || '',
          date: transfer.created_at ? new Date(transfer.created_at).toLocaleString() : 'N/A',
          warehouse: getWarehouseName(transfer.warehouse_id || invoice?.warehouse_id || invoice?.receiving_warehouse_id),
          type: isSell ? 'sell' : 'buy',
          quantity,
          totalAmount: Number(transfer.total_amount ?? invoice?.total_amount ?? invoice?.total_cost ?? 0),
          status: transfer.status || invoice?.status || 'N/A',
          items: itemSummary,
          customerName: transfer.customer_name || invoice?.customer_name || client.name || 'N/A',
          invoiceKind: isSell ? 'sale' as const : 'purchase' as const,
          invoice,
        };
      })
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime();
        const rightTime = new Date(right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
  }, [client, getVariantLabel, products, purchaseInvoices, revenueInvoices, transfers, variants, warehouses]);

  const handleExportExcel = () => {
    if (!client || transferRows.length === 0) {
      toast.info('No client transfers available to export');
      return;
    }

    exportRowsToExcel(
      `${client.name.replace(/\s+/g, '_')}_transfers.xls`,
      `${client.name} Transfers`,
      ['Transfer ID', 'Invoice', 'Date', 'Warehouse', 'Type', 'Quantity', 'Total', 'Status', 'Items'],
      transferRows.map((row) => [
        row.transferId,
        row.invoiceNumber,
        row.date,
        row.warehouse,
        row.type,
        row.quantity,
        row.totalAmount,
        row.status,
        row.items,
      ])
    );
  };

  const handleExportPdf = () => {
    if (!client || transferRows.length === 0) {
      toast.info('No client transfers available to export');
      return;
    }

  const totalPaid = transferRows
    .filter((row) => row.invoiceKind === 'sale' && row.status === 'paid')
    .reduce((sum, row) => sum + row.totalAmount, 0);
    const totalOpen = transferRows
      .filter((row) => row.invoiceKind === 'sale' && row.status !== 'paid' && row.status !== 'cancelled')
      .reduce((sum, row) => sum + row.totalAmount, 0);

    const lines = [
      `${client.name} Transfers`,
      `Email: ${client.email || 'N/A'}`,
      `Phone: ${client.phone || 'N/A'}`,
      `Location: ${client.location || 'N/A'}`,
      `Total value: ${totalAmount}`,
      `Paid sales: ${totalPaid}`,
      `Open sales: ${totalOpen}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Transfer ID | Invoice | Date | Warehouse | Type | Qty | Total | Status | Items',
      ...transferRows.map(
        (row) =>
          `${row.transferId} | ${row.invoiceNumber} | ${row.date} | ${row.warehouse} | ${row.type} | ${row.quantity} | ${row.totalAmount} | ${row.status} | ${row.items}`
      ),
    ];

    exportTextLinesToPdf(`${client.name.replace(/\s+/g, '_')}_transfers.pdf`, lines);
  };

  if (!client) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Client not found.</p>
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </button>
      </div>
    );
  }

  const totalAmount = transferRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const totalQuantity = transferRows.reduce((sum, row) => sum + row.quantity, 0);
  const summary = calculateClientFinancials(client, revenueInvoices, purchaseInvoices, clientPayments);
  const salesValue = transferRows
    .filter((row) => row.invoiceKind === 'sale')
    .reduce((sum, row) => sum + row.totalAmount, 0);
  const buysValue = transferRows
    .filter((row) => row.invoiceKind === 'purchase')
    .reduce((sum, row) => sum + row.totalAmount, 0);
  const clientOwesUs = summary.customer_owes_us;
  const weOweClient = summary.we_owe_customer;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.12),_transparent_35%),linear-gradient(135deg,#111827,#1f2937)] px-8 py-8 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Clients
              </button>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-white/60">Client Transfers</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">{client.name}</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Review all buy and sell transfers for this client, then open the invoice from any transfer row.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-100 px-8 py-6 md:grid-cols-5">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Email</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{client.email || 'N/A'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Phone</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{client.phone || 'N/A'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Transfers</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{transferRows.length}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Sales + Buys</p>
            <p className="mt-2 text-2xl font-black text-gray-900">${totalAmount.toLocaleString()}</p>
          </div>
          <div className={`rounded-2xl p-4 ${clientOwesUs > 0 ? 'bg-emerald-50' : weOweClient > 0 ? 'bg-violet-50' : 'bg-gray-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest ${clientOwesUs > 0 ? 'text-emerald-700' : weOweClient > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
              Balance
            </p>
            <p className={`mt-2 text-xl font-black ${clientOwesUs > 0 ? 'text-emerald-700' : weOweClient > 0 ? 'text-violet-700' : 'text-gray-900'}`}>
              ${Math.max(clientOwesUs, weOweClient).toLocaleString()}
            </p>
            <p className={`mt-1 text-xs font-semibold ${clientOwesUs > 0 ? 'text-emerald-600' : weOweClient > 0 ? 'text-violet-600' : 'text-gray-500'}`}>
              {clientOwesUs > 0 ? 'Customer still owes us' : weOweClient > 0 ? 'We still owe the customer' : 'Settled'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 px-8 py-6 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Location</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{client.location || 'N/A'}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Quantity</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Sell Value</p>
            <p className="mt-2 text-sm font-semibold text-indigo-900">${salesValue.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Buy Value</p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">${buysValue.toLocaleString()}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          {transferRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <Download className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-4 text-sm font-semibold text-gray-500">No transfers found for this client yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Transfer ID</th>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transferRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-mono text-xs font-bold text-gray-900">{row.transferId}</div>
                          <div className="text-xs text-gray-400">{row.customerName}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-gray-900">{row.invoiceNumber}</td>
                        <td className="px-4 py-4 text-gray-600">{row.date}</td>
                        <td className="px-4 py-4 text-gray-700">{row.warehouse}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.type === 'sell' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{row.items}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-800">{row.quantity}</td>
                        <td className="px-4 py-4 text-right font-bold text-gray-900">${row.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTransfer(row)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            Open Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTransfer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close invoice"
            onClick={() => setSelectedTransfer(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-2xl rounded-[2.5rem] border border-white/20 bg-white p-8 shadow-2xl">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-3xl ${selectedTransfer.invoiceKind === 'sale' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  <Receipt className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">
                    {selectedTransfer.invoiceKind === 'sale' ? 'Sale Invoice' : 'Purchase Invoice'}
                  </h3>
                  <p className="mt-1 inline-block rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Invoice #{selectedTransfer.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="rounded-2xl p-3 text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <InfoRow label="Transfer ID" value={selectedTransfer.transferId} />
                <InfoRow label="Client" value={selectedTransfer.customerName} />
                <InfoRow label="Warehouse" value={selectedTransfer.warehouse} />
                <InfoRow label="Type" value={selectedTransfer.type} />
                <InfoRow label="Status" value={selectedTransfer.status} />
              </div>
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <InfoRow label="Date" value={selectedTransfer.date} />
                <InfoRow label="Items" value={selectedTransfer.items} />
                <InfoRow label="Quantity" value={selectedTransfer.quantity.toLocaleString()} />
                <InfoRow label="Subtotal" value={`$${Number(selectedTransfer.invoice.subtotal || selectedTransfer.totalAmount || 0).toLocaleString()}`} />
                {'vat_amount' in selectedTransfer.invoice && (
                  <InfoRow label="VAT" value={`$${Number(selectedTransfer.invoice.vat_amount || 0).toLocaleString()}`} />
                )}
                {selectedTransfer.type === 'sell' && (
                  <>
                    <InfoRow label="COGS" value={`$${Number(selectedTransfer.invoice?.cogs_amount || 0).toLocaleString()}`} />
                    <InfoRow label="Gross Profit" value={`$${Number(selectedTransfer.invoice?.gross_profit || 0).toLocaleString()}`} />
                  </>
                )}
                <InfoRow
                  label="Total"
                  value={<span className="text-lg font-black text-gray-900">${selectedTransfer.totalAmount.toLocaleString()}</span>}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
