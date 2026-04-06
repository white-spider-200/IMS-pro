import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, FileSpreadsheet, FileText, Receipt, X } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { exportRowsToExcel, exportTextLinesToPdf } from '../lib/fileExports';
import { hasValidTransferTotals, sanitizeMoney, sanitizeQuantity } from '../lib/financialGuards';

type OutletContext = {
  suppliers?: any[];
  warehouses?: any[];
  transfers?: any[];
  purchaseInvoices?: any[];
  variants?: any[];
  products?: any[];
};

type SupplierTransferRow = {
  id: string;
  transferId: string;
  invoiceNumber: string;
  createdAt: string;
  date: string;
  warehouse: string;
  item: string;
  quantity: number;
  totalAmount: number;
  status: string;
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

export default function SupplierTransfersPage() {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const [selectedTransfer, setSelectedTransfer] = useState<SupplierTransferRow | null>(null);
  const {
    suppliers = [],
    warehouses = [],
    transfers = [],
    purchaseInvoices = [],
    variants = [],
    products = [],
  } = useOutletContext<OutletContext>();

  const supplier = useMemo(
    () => suppliers.find((entry) => entry.id === supplierId) || null,
    [supplierId, suppliers]
  );

  const getWarehouseName = (warehouseId: string) =>
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || 'Unknown Warehouse';

  const transferRows = useMemo<SupplierTransferRow[]>(() => {
    if (!supplier) return [];

    return transfers
      .filter((transfer) => {
        if (!['buy_order'].includes(String(transfer.transfer_type || ''))) return false;
        return transfer.supplier_id === supplier.id;
      })
      .map((transfer) => {
        const invoice = purchaseInvoices.find((entry) => entry.id === transfer.purchase_invoice_id) || null;
        const variant = variants.find((entry) => entry.id === (transfer.product_variant_id || invoice?.product_variant_id));
        const product = products.find((entry) => entry.id === (transfer.product_id || variant?.product_id || invoice?.product_id));

        return {
          id: transfer.id,
          transferId: transfer.transfer_number || transfer.id,
          invoiceNumber: invoice?.invoice_number || 'N/A',
          createdAt: transfer.created_at || invoice?.created_at || '',
          date: transfer.created_at ? new Date(transfer.created_at).toLocaleString() : 'N/A',
          warehouse: getWarehouseName(transfer.warehouse_id || invoice?.receiving_warehouse_id),
          item: variant ? `${product?.name || 'Unknown Product'} / ${variant.variant_code || variant.barcode}` : product?.name || 'N/A',
          quantity: sanitizeQuantity(transfer.quantity ?? invoice?.quantity_purchased ?? invoice?.requested_quantity ?? 0),
          totalAmount: sanitizeMoney(transfer.total_amount ?? invoice?.total_cost ?? 0),
          status: transfer.status || invoice?.status || 'N/A',
          invoice,
        };
      })
      .filter((row) => hasValidTransferTotals({ quantity: row.quantity, total_amount: row.totalAmount }, row.invoice))
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }, [products, purchaseInvoices, supplier, transfers, variants, warehouses]);

  const handleExportExcel = () => {
    if (!supplier || transferRows.length === 0) {
      toast.info('No supplier transfers available to export');
      return;
    }

    exportRowsToExcel(
      `${supplier.name.replace(/\s+/g, '_')}_transfers.xls`,
      `${supplier.name} Transfers`,
      ['Transfer ID', 'Invoice', 'Date', 'Warehouse', 'Item', 'Quantity', 'Total', 'Status'],
      transferRows.map((row) => [
        row.transferId,
        row.invoiceNumber,
        row.date,
        row.warehouse,
        row.item,
        row.quantity,
        row.totalAmount,
        row.status,
      ])
    );
  };

  const handleExportPdf = () => {
    if (!supplier || transferRows.length === 0) {
      toast.info('No supplier transfers available to export');
      return;
    }

    const lines = [
      `${supplier.name} Transfers`,
      `Email: ${supplier.email || 'N/A'}`,
      `Phone: ${supplier.phone || 'N/A'}`,
      `Country: ${supplier.country || 'N/A'}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Transfer ID | Invoice | Date | Warehouse | Item | Quantity | Total | Status',
      ...transferRows.map(
        (row) =>
          `${row.transferId} | ${row.invoiceNumber} | ${row.date} | ${row.warehouse} | ${row.item} | ${row.quantity} | ${row.totalAmount} | ${row.status}`
      ),
    ];

    exportTextLinesToPdf(`${supplier.name.replace(/\s+/g, '_')}_transfers.pdf`, lines);
  };

  if (!supplier) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Supplier not found.</p>
        <button
          type="button"
          onClick={() => navigate('/suppliers')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </button>
      </div>
    );
  }

  const totalQuantity = transferRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = transferRows.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.12),_transparent_35%),linear-gradient(135deg,#111827,#1f2937)] px-8 py-8 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate('/suppliers')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Suppliers
              </button>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-white/60">Supplier Transfers</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">{supplier.name}</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Review supplier purchase transfers and open the invoice for any transfer directly from the table.
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

        <div className="grid gap-4 border-b border-gray-100 px-8 py-6 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Email</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{supplier.email || 'N/A'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Phone</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{supplier.phone || 'N/A'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Transfers</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{transferRows.length}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Value</p>
            <p className="mt-2 text-2xl font-black text-gray-900">${totalAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid gap-4 px-8 py-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Country</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{supplier.country || 'N/A'}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Quantity</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Invoice Access</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">Use the invoice button on any transfer row below.</p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          {transferRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <Download className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-4 text-sm font-semibold text-gray-500">No supplier transfers found yet.</p>
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
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transferRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-xs font-bold text-gray-900">{row.transferId}</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">{row.invoiceNumber}</td>
                        <td className="px-4 py-4 text-gray-600">{row.date}</td>
                        <td className="px-4 py-4 text-gray-700">{row.warehouse}</td>
                        <td className="px-4 py-4 text-gray-700">{row.item}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-800">{row.quantity.toLocaleString()}</td>
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
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-700">
                  <Receipt className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Purchase Invoice</h3>
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
                <InfoRow label="Supplier" value={supplier.name || 'N/A'} />
                <InfoRow label="Warehouse" value={selectedTransfer.warehouse} />
                <InfoRow label="Status" value={selectedTransfer.status} />
                <InfoRow label="Date" value={selectedTransfer.date} />
              </div>
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <InfoRow label="Item" value={selectedTransfer.item} />
                <InfoRow label="Quantity" value={selectedTransfer.quantity.toLocaleString()} />
                <InfoRow label="Unit Cost" value={`$${Number(selectedTransfer.invoice.unit_cost || 0).toLocaleString()}`} />
                <InfoRow label="VAT" value={`$${Number(selectedTransfer.invoice.vat_amount || 0).toLocaleString()}`} />
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
