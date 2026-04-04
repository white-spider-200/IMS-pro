import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ArrowRight,
  Package,
  User,
  Warehouse as WarehouseIcon,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Tag,
  FileText,
  DollarSign,
  Hash,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import InventoryService from '../services/inventoryService';
import { buyFromCustomerDemoStock } from '../demo/demoDatabase';
import SearchableSelect from '../components/SearchableSelect';

type BuyPageContext = {
  isDemoMode?: boolean;
  clients: any[];
  products: any[];
  variants: any[];
  warehouses: any[];
  brands: any[];
  categories: any[];
  suppliers: any[];
};

/* ─── Reusable styled form field wrapper ──────────────────────── */
function FieldGroup({ label, icon: Icon, error, children }: { label: string; icon: React.ElementType; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${error ? 'text-amber-500' : 'text-indigo-500'}`} />
        <label className={`text-xs font-semibold uppercase tracking-widest ${error ? 'text-amber-600' : 'text-slate-500'}`}>{label}</label>
      </div>
      {children}
      {error && <p className="text-xs text-amber-600 font-medium">{error}</p>}
    </div>
  );
}

const inputCls = (error?: boolean) => `w-full rounded-xl border bg-white/70 px-4 py-2 text-sm text-slate-800 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 min-h-[44px] ${error ? 'border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400'}`;

const textareaCls = (error?: boolean) => `w-full rounded-xl border bg-white/70 px-4 py-2 text-sm text-slate-800 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 resize-none ${error ? 'border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400'}`;

/* ─── Summary row ─────────────────────────────────────────────── */
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'border-t border-slate-100 mt-1 pt-3' : ''}`}>
      <span className={`text-xs ${highlight ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-indigo-600 text-sm' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

export default function BuyPage() {
  const { isDemoMode, clients, products, variants, warehouses, brands, categories, suppliers } =
    useOutletContext<BuyPageContext>();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [recordPaymentNow, setRecordPaymentNow] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionTime, setTransactionTime] = useState(() => new Date().toISOString());
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  /* derived */
  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId), [clients, selectedClientId]);
  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId), [products, selectedProductId]);
  const productVariants = useMemo(() => variants.filter((v) => v.product_id === selectedProductId), [selectedProductId, variants]);
  const activeVariant = useMemo(() => productVariants.find((v) => v.id === selectedVariantId) || null, [productVariants, selectedVariantId]);
  const selectedWarehouse = useMemo(() => warehouses.find((w) => w.id === selectedWarehouseId), [warehouses, selectedWarehouseId]);
  const selectedBrand = useMemo(() => brands.find((b) => b.id === selectedProduct?.brand_id), [brands, selectedProduct?.brand_id]);
  const selectedCategory = useMemo(() => categories.find((c) => c.id === selectedProduct?.category_id), [categories, selectedProduct?.category_id]);
  const selectedSupplier = useMemo(() => suppliers.find((s) => s.id === selectedProduct?.supplier_id), [selectedProduct?.supplier_id, suppliers]);

  const numericQuantity = Number(quantity);
  const numericUnitCost = Number(unitCost || 0);
  const numericPaymentAmount = Number(paymentAmount || 0);
  const subtotal = Number.isFinite(numericQuantity) && Number.isFinite(numericUnitCost) ? numericQuantity * numericUnitCost : 0;
  const totalCost = subtotal;

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedVariantId('');
    setSelectedWarehouseId('');
    setUnitCost('');
  };

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    setSelectedWarehouseId('');
    const variant = productVariants.find((v) => v.id === variantId);
    if (variant && Number.isFinite(Number(variant.unit_cost))) {
      setUnitCost(String(Number(variant.unit_cost)));
    }
  };

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!selectedClientId) errors.clientId = 'Customer is required.';
    if (!selectedProductId) errors.productId = 'Product is required.';
    if (!selectedVariantId) errors.variantId = 'Variant is required.';
    if (!selectedWarehouseId) errors.warehouseId = 'Warehouse is required.';
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) errors.quantity = 'Quantity must be greater than zero.';
    if (!Number.isFinite(numericUnitCost) || numericUnitCost < 0) errors.unitCost = 'Buy price must be zero or greater.';
    if (recordPaymentNow) {
      if (!Number.isFinite(numericPaymentAmount) || numericPaymentAmount <= 0) errors.paymentAmount = 'Payment amount must be greater than zero.';
      if (numericPaymentAmount > totalCost) errors.paymentAmount = 'Payment amount cannot exceed total cost.';
    }
    return errors;
  }, [selectedClientId, selectedProductId, selectedVariantId, selectedWarehouseId, numericQuantity, numericUnitCost, recordPaymentNow, numericPaymentAmount, totalCost]);

  const validationErrors = Object.values(fieldErrors);

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedWarehouseId('');
    setQuantity('');
    setUnitCost('');
    setNotes('');
    setRecordPaymentNow(false);
    setPaymentAmount('');
    setPaymentNotes('');
    setTransactionTime(new Date().toISOString());
    setHasAttemptedSubmit(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    if (!selectedClient || !selectedProduct || !activeVariant || !selectedWarehouse || validationErrors.length > 0) {
      toast.error('Please fix the errors in the form before submitting.');
      return;
    }
    const idempotencyKey = `BUY-CUSTOMER-${Date.now()}`;
    setIsProcessing(true);
    try {
      if (isDemoMode) {
        buyFromCustomerDemoStock(
          activeVariant.id, selectedProduct.id, selectedWarehouse.id, numericQuantity,
          selectedClient.id, selectedClient.name, numericUnitCost,
          {
            notes: notes || `Purchased stock from ${selectedClient.name}`,
            paymentAmount: recordPaymentNow ? numericPaymentAmount : 0,
            paymentNotes,
            transactionTime,
          },
          idempotencyKey
        );
      } else {
        await InventoryService.buyFromCustomer({
          variantId: activeVariant.id, productId: selectedProduct.id,
          clientId: selectedClient.id, clientName: selectedClient.name,
          warehouseId: selectedWarehouse.id, quantity: numericQuantity,
          unitCost: numericUnitCost,
          paymentAmount: recordPaymentNow ? numericPaymentAmount : 0,
          paymentNotes,
          notes: notes || `Purchased stock from ${selectedClient.name}`,
          idempotencyKey,
          transactionTime,
        });
      }
      toast.success('Buy transaction recorded into warehouse inventory.');
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to process buy transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  const formComplete = validationErrors.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-1">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 px-8 py-6 shadow-lg shadow-indigo-200">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-24 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <ShoppingCart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Buy from Customer</h1>
            <p className="mt-0.5 text-sm text-indigo-100">
              Record incoming stock purchased from a customer into your warehouse.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_380px]">

        {/* ── LEFT: Form ────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Customer */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Customer</h2>
            </div>
            <FieldGroup label="Select customer" icon={User} error={hasAttemptedSubmit ? fieldErrors.clientId : undefined}>
              <SearchableSelect
                value={selectedClientId}
                onChange={setSelectedClientId}
                options={clients.map(c => ({ value: c.id, label: c.name, subLabel: c.email || c.phone }))}
                placeholder="Search and select customer"
                error={hasAttemptedSubmit && !!fieldErrors.clientId}
              />
            </FieldGroup>
          </div>

          {/* Product */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Product</h2>
            </div>
            <div className="space-y-4">
              <FieldGroup label="Product" icon={Package} error={hasAttemptedSubmit ? fieldErrors.productId : undefined}>
                <SearchableSelect
                  value={selectedProductId}
                  onChange={handleProductChange}
                  options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.sku }))}
                  placeholder="Search and select product"
                  error={hasAttemptedSubmit && !!fieldErrors.productId}
                />
              </FieldGroup>

              <FieldGroup label="Variant" icon={Tag} error={hasAttemptedSubmit ? fieldErrors.variantId : undefined}>
                <SearchableSelect
                  value={selectedVariantId}
                  onChange={handleVariantChange}
                  options={productVariants.map(v => ({ value: v.id, label: v.variant_code || 'Variant', subLabel: v.barcode }))}
                  placeholder="Select product variant"
                  disabled={!selectedProductId}
                  error={hasAttemptedSubmit && !!fieldErrors.variantId}
                />
              </FieldGroup>

              {activeVariant && (
                <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-violet-500" />
                  <p className="text-xs text-violet-700">
                    Inventory tracked as: <span className="font-bold">{activeVariant.variant_code || activeVariant.barcode}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Warehouse + Pricing */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                <WarehouseIcon className="h-4 w-4 text-sky-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Warehouse & Pricing</h2>
            </div>
            <div className="space-y-4">
              <FieldGroup label="Destination warehouse" icon={WarehouseIcon} error={hasAttemptedSubmit ? fieldErrors.warehouseId : undefined}>
                <SearchableSelect
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  options={warehouses.map(w => ({ value: w.id, label: w.name, subLabel: w.location }))}
                  placeholder="Select warehouse"
                  error={hasAttemptedSubmit && !!fieldErrors.warehouseId}
                />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Quantity" icon={Hash} error={hasAttemptedSubmit ? fieldErrors.quantity : undefined}>
                  <input
                    type="number" min="1" step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputCls(hasAttemptedSubmit && !!fieldErrors.quantity)}
                    placeholder="0"
                  />
                </FieldGroup>
                <FieldGroup label="Buy price per unit" icon={DollarSign} error={hasAttemptedSubmit ? fieldErrors.unitCost : undefined}>
                  <input
                    type="number" min="0" step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className={inputCls(hasAttemptedSubmit && !!fieldErrors.unitCost)}
                    placeholder="0.00"
                  />
                </FieldGroup>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <FieldGroup label="Notes" icon={FileText}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={textareaCls()}
                placeholder="Optional internal notes about this buy transaction…"
              />
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Down Payment</h2>
                <p className="mt-1 text-sm text-slate-500">Optional. If you leave this off, the full invoice goes to Aged Payable.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordPaymentNow}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRecordPaymentNow(checked);
                    if (!checked) {
                      setPaymentAmount('');
                      setPaymentNotes('');
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Add down payment
              </label>
            </div>

            {recordPaymentNow && (
              <div className="mt-6 pt-6 border-t border-slate-100 grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Down payment amount" icon={DollarSign} error={hasAttemptedSubmit ? fieldErrors.paymentAmount : undefined}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={inputCls(hasAttemptedSubmit && !!fieldErrors.paymentAmount)}
                    placeholder="0.00"
                  />
                </FieldGroup>
                <FieldGroup label="Payment note" icon={FileText}>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className={inputCls()}
                    placeholder="Cash, bank transfer, receipt note..."
                  />
                </FieldGroup>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Buy
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </form>

        {/* ── RIGHT: Summary sidebar ─────────────────────────── */}
        <aside className="space-y-5">
          {/* Completion indicator */}
          <div className={`rounded-2xl border p-5 shadow-sm transition ${formComplete
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
            : 'border-slate-100 bg-white'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${formComplete ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                {formComplete
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <ShoppingCart className="h-5 w-5 text-slate-400" />
                }
              </div>
              <div>
                <p className={`text-sm font-bold ${formComplete ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {formComplete ? 'Ready to confirm' : 'Filling form…'}
                </p>
                <p className="text-xs text-slate-400">
                  {formComplete ? 'All required fields are filled.' : `${validationErrors.length} field(s) remaining`}
                </p>
              </div>
            </div>
          </div>

          {/* Product card */}
          {selectedProduct && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Product Info</h3>
              <div className="mb-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name || 'Selected product'}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-slate-400">
                    <Package className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {[
                  ['Name', selectedProduct.name],
                  ['SKU', selectedProduct.sku],
                  ['Variant', activeVariant?.variant_code || activeVariant?.barcode || '—'],
                  ['Brand', selectedBrand?.name || selectedProduct.brand],
                  ['Category', selectedCategory?.name || selectedProduct.category],
                  ['Supplier', selectedSupplier?.name || selectedProduct.supplier],
                  ['Description', selectedProduct.description],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-2 text-xs">
                    <span className="flex-shrink-0 font-semibold text-slate-500">{label}</span>
                    <span className="text-right text-slate-800">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setIsSummaryOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Order Summary</h3>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isSummaryOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSummaryOpen && (
              <div className="mt-3 divide-y divide-slate-50">
                <SummaryRow label="Customer" value={selectedClient?.name || '—'} />
                <SummaryRow label="Product" value={selectedProduct?.name || '—'} />
                <SummaryRow label="Warehouse" value={selectedWarehouse?.name || '—'} />
                <SummaryRow label="Time" value={new Date(transactionTime).toLocaleString()} />
                <SummaryRow label="Quantity" value={numericQuantity > 0 ? String(numericQuantity) : '0'} />
                <SummaryRow label="Unit price" value={`$${numericUnitCost.toFixed(2)}`} />
                <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
                <SummaryRow label="Down payment" value={recordPaymentNow ? `$${numericPaymentAmount.toFixed(2)}` : '$0.00'} />
                <SummaryRow label="Total Cost" value={`$${totalCost.toFixed(2)}`} highlight />
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-xs leading-relaxed text-sky-700">
              <span className="font-bold">ℹ️ Buy flow:</span> this transaction increases stock in the selected warehouse because you are purchasing goods from the customer into your inventory.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
