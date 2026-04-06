import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileText,
  Hash,
  RotateCcw,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import InventoryService from '../services/inventoryService';
import { returnDemoStock } from '../demo/demoDatabase';

type ReturnPageContext = {
  isDemoMode?: boolean;
  clients: any[];
  products: any[];
  variants: any[];
  warehouses: any[];
  balances: any[];
  revenueInvoices?: any[];
  purchaseInvoices?: any[];
  returnInvoices?: any[];
};

function FieldGroup({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-500" />
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      </div>
      {children}
    </div>
  );
}

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed appearance-none';
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400';
const textareaCls =
  'w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 resize-none';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}

export default function ReturnPage() {
  const {
    isDemoMode,
    clients,
    products,
    variants,
    warehouses,
    balances,
    revenueInvoices = [],
    purchaseInvoices = [],
    returnInvoices = [],
  } = useOutletContext<ReturnPageContext>();

  const [returnScope, setReturnScope] = useState<'sale' | 'purchase'>('sale');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionTime, setTransactionTime] = useState(() => new Date().toISOString());

  const invoiceOptions = useMemo(() => {
    if (returnScope === 'sale') {
      return revenueInvoices
        .filter((invoice) => invoice.status !== 'cancelled')
        .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
    }

    return purchaseInvoices
      .filter((invoice) => invoice.source_type === 'customer' && invoice.status !== 'cancelled')
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  }, [purchaseInvoices, returnScope, revenueInvoices]);

  const selectedInvoice = useMemo(
    () => invoiceOptions.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoiceOptions, selectedInvoiceId]
  );

  const derivedInvoiceData = useMemo(() => {
    if (!selectedInvoice) return null;

    if (returnScope === 'sale') {
      const firstItem = Array.isArray(selectedInvoice.items) ? selectedInvoice.items[0] : null;
      const variantId = firstItem?.variant_id || null;
      const product = products.find((entry) => entry.id === variants.find((variant) => variant.id === variantId)?.product_id) || null;
      return {
        clientId: selectedInvoice.client_id || null,
        clientName: selectedInvoice.customer_name || '',
        productId: product?.id || '',
        productName: product?.name || 'Unknown Product',
        variantId: variantId || '',
        variantName: variants.find((variant) => variant.id === variantId)?.variant_code || variants.find((variant) => variant.id === variantId)?.barcode || 'Unknown Variant',
        warehouseId: selectedInvoice.warehouse_id || '',
        warehouseName: warehouses.find((warehouse) => warehouse.id === selectedInvoice.warehouse_id)?.name || 'Unknown Warehouse',
        totalQuantity: Number(firstItem?.quantity || 0),
        unitAmount: Number(firstItem?.unit_price || 0),
      };
    }

    const variantId = selectedInvoice.product_variant_id || '';
    const product = products.find((entry) => entry.id === selectedInvoice.product_id) || null;
    return {
      clientId: selectedInvoice.client_id || null,
      clientName: clients.find((client) => client.id === selectedInvoice.client_id)?.name || 'Unknown Customer',
      productId: selectedInvoice.product_id || '',
      productName: product?.name || 'Unknown Product',
      variantId,
      variantName: variants.find((variant) => variant.id === variantId)?.variant_code || variants.find((variant) => variant.id === variantId)?.barcode || 'Unknown Variant',
      warehouseId: selectedInvoice.receiving_warehouse_id || selectedInvoice.warehouse_id || '',
      warehouseName: warehouses.find((warehouse) => warehouse.id === (selectedInvoice.receiving_warehouse_id || selectedInvoice.warehouse_id))?.name || 'Unknown Warehouse',
      totalQuantity: Number(selectedInvoice.quantity_purchased || selectedInvoice.requested_quantity || 0),
      unitAmount: Number(selectedInvoice.unit_cost || 0),
    };
  }, [clients, products, returnScope, selectedInvoice, variants, warehouses]);

  const alreadyReturnedQuantity = useMemo(() => {
    if (!selectedInvoiceId) return 0;
    return returnInvoices
      .filter((invoice) => invoice.original_invoice_id === selectedInvoiceId)
      .reduce((sum, invoice) => sum + Number(invoice.quantity || 0), 0);
  }, [returnInvoices, selectedInvoiceId]);

  const maxReturnQuantity = useMemo(() => {
    return Math.max(Number(derivedInvoiceData?.totalQuantity || 0) - alreadyReturnedQuantity, 0);
  }, [alreadyReturnedQuantity, derivedInvoiceData?.totalQuantity]);

  const availableQuantity = useMemo(() => {
    if (!derivedInvoiceData?.variantId || !derivedInvoiceData?.warehouseId) return 0;
    const balance = balances.find(
      (entry) => entry.variant_id === derivedInvoiceData.variantId && entry.warehouse_id === derivedInvoiceData.warehouseId
    );
    return Number(balance?.available_quantity || 0);
  }, [balances, derivedInvoiceData?.variantId, derivedInvoiceData?.warehouseId]);

  const numericQuantity = Number(quantity);
  const unitAmount = Number(derivedInvoiceData?.unitAmount || 0);
  const totalAmount = Number.isFinite(numericQuantity) && Number.isFinite(unitAmount) ? numericQuantity * unitAmount : 0;

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!selectedInvoice) errors.push('Source invoice is required.');
    if (!derivedInvoiceData?.variantId) errors.push('The selected invoice does not have a valid product line.');
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) errors.push('Quantity must be greater than zero.');
    if (numericQuantity > maxReturnQuantity) errors.push('Return quantity cannot exceed the remaining invoice quantity.');
    if (returnScope === 'purchase' && numericQuantity > availableQuantity) {
      errors.push('Not enough stock in the warehouse for this buy return.');
    }
    return Array.from(new Set(errors));
  }, [availableQuantity, derivedInvoiceData?.variantId, maxReturnQuantity, numericQuantity, returnScope, selectedInvoice]);

  const resetForm = () => {
    setReturnScope('sale');
    setSelectedInvoiceId('');
    setQuantity('');
    setNotes('');
    setTransactionTime(new Date().toISOString());
  };

  const handleScopeChange = (scope: 'sale' | 'purchase') => {
    setReturnScope(scope);
    setSelectedInvoiceId('');
    setQuantity('');
    setNotes('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedInvoice || !derivedInvoiceData || validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    setIsProcessing(true);
    const idempotencyKey = `RETURN-${Date.now()}`;

    try {
      const payload = {
        variantId: derivedInvoiceData.variantId,
        productId: derivedInvoiceData.productId,
        warehouseId: derivedInvoiceData.warehouseId,
        quantity: numericQuantity,
        clientId: derivedInvoiceData.clientId,
        clientName: derivedInvoiceData.clientName,
        unitAmount,
        returnScope,
        originalInvoiceId: selectedInvoice.id,
        notes: notes || `Return based on invoice ${selectedInvoice.invoice_number}`,
        transactionTime,
        idempotencyKey,
      };

      if (isDemoMode) {
        returnDemoStock(payload);
      } else {
        await InventoryService.returnStock(payload);
      }

      toast.success('Return recorded successfully.');
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to process return');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-8 py-6 shadow-lg shadow-orange-200">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-24 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <RotateCcw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Return</h1>
            <p className="mt-0.5 text-sm text-orange-50">
              Create returns from existing sell or buy invoices only.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_380px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Return Type</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleScopeChange('sale')}
                className={`rounded-2xl border px-4 py-4 text-left ${returnScope === 'sale' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">Sale Return</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Choose a sell invoice and return against it.</p>
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange('purchase')}
                className={`rounded-2xl border px-4 py-4 text-left ${returnScope === 'purchase' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-slate-800">Buy Return</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Choose a buy invoice and return against it.</p>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <FieldGroup label={returnScope === 'sale' ? 'Sell invoice' : 'Buy invoice'} icon={FileText}>
              <select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)} className={selectCls}>
                <option value="">— Choose invoice —</option>
                {invoiceOptions.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.customer_name || clients.find((client) => client.id === invoice.client_id)?.name || 'Customer'}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup label="Return Quantity" icon={Hash}>
                <input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputCls} placeholder="0" disabled={!selectedInvoice} />
              </FieldGroup>
              <FieldGroup label="Time" icon={FileText}>
                <input type="datetime-local" value={transactionTime.slice(0, 16)} onChange={(event) => setTransactionTime(new Date(event.target.value).toISOString())} className={inputCls} />
              </FieldGroup>
            </div>

            {selectedInvoice ? (
              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                Invoice quantity: <span className="font-bold">{derivedInvoiceData?.totalQuantity || 0}</span>
                {' · '}
                Already returned: <span className="font-bold">{alreadyReturnedQuantity}</span>
                {' · '}
                Remaining allowed: <span className="font-bold">{maxReturnQuantity}</span>
                {returnScope === 'purchase' ? (
                  <>
                    {' · '}
                    Stock available in warehouse: <span className="font-bold">{availableQuantity}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <FieldGroup label="Notes" icon={FileText}>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={textareaCls} placeholder="Optional notes about this return…" />
            </FieldGroup>
          </div>

          {validationErrors.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">{validationErrors[0]}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isProcessing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-orange-200 transition hover:from-amber-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Return
              </>
            )}
          </button>
        </form>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Invoice Summary</h3>
              <RotateCcw className="h-4 w-4 text-orange-500" />
            </div>
            <div className="mt-4 space-y-1">
              <SummaryRow label="Return Type" value={returnScope === 'sale' ? 'Sale Return' : 'Buy Return'} />
              <SummaryRow label="Invoice" value={selectedInvoice?.invoice_number || '—'} />
              <SummaryRow label="Customer" value={derivedInvoiceData?.clientName || '—'} />
              <SummaryRow label="Product" value={derivedInvoiceData?.productName || '—'} />
              <SummaryRow label="Variant" value={derivedInvoiceData?.variantName || '—'} />
              <SummaryRow label="Warehouse" value={derivedInvoiceData?.warehouseName || '—'} />
              <SummaryRow label="Unit Amount" value={`$${unitAmount.toLocaleString()}`} />
              <SummaryRow label="Return Quantity" value={numericQuantity > 0 ? String(numericQuantity) : '0'} />
              <SummaryRow label="Total" value={`$${totalAmount.toLocaleString()}`} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
