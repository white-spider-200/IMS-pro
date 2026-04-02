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
import { issueDemoStock } from '../demo/demoDatabase';

type SellPageContext = {
  isDemoMode?: boolean;
  clients: any[];
  products: any[];
  variants: any[];
  warehouses: any[];
  balances: any[];
  purchaseInvoices?: any[];
  brands: any[];
  categories: any[];
  suppliers: any[];
};

const VAT_OPTIONS = ['0', '5', '10', '16'];

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

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'border-t border-slate-100 mt-1 pt-3' : ''}`}>
      <span className={`text-xs ${highlight ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-indigo-600 text-sm' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

export default function SellPage() {
  const { isDemoMode, clients, products, variants, warehouses, balances, purchaseInvoices = [], brands, categories, suppliers } =
    useOutletContext<SellPageContext>();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [vatRate, setVatRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionTime, setTransactionTime] = useState(() => new Date().toISOString());
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId), [products, selectedProductId]);
  const productVariants = useMemo(() => variants.filter((variant) => variant.product_id === selectedProductId), [selectedProductId, variants]);
  const activeVariant = useMemo(() => productVariants.find((variant) => variant.id === selectedVariantId) || null, [productVariants, selectedVariantId]);

  const warehousesWithStock = useMemo(() => {
    if (!activeVariant) return [];
    return warehouses
      .map((warehouse) => {
        const balance = balances.find(
          (entry) => entry.variant_id === activeVariant.id && entry.warehouse_id === warehouse.id
        );
        return {
          ...warehouse,
          availableQuantity: Number(balance?.available_quantity || 0),
        };
      })
      .filter((warehouse) => warehouse.availableQuantity > 0)
      .sort((left, right) => right.availableQuantity - left.availableQuantity);
  }, [activeVariant, balances, warehouses]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
    [warehouses, selectedWarehouseId]
  );

  const availableQuantity = useMemo(() => {
    if (!activeVariant || !selectedWarehouseId) return 0;
    const warehouse = warehousesWithStock.find((entry) => entry.id === selectedWarehouseId);
    return Number(warehouse?.availableQuantity || 0);
  }, [activeVariant, selectedWarehouseId, warehousesWithStock]);

  const selectedBrand = useMemo(() => brands.find((brand) => brand.id === selectedProduct?.brand_id), [brands, selectedProduct?.brand_id]);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === selectedProduct?.category_id), [categories, selectedProduct?.category_id]);
  const selectedSupplier = useMemo(() => suppliers.find((supplier) => supplier.id === selectedProduct?.supplier_id), [selectedProduct?.supplier_id, suppliers]);
  const averageBuySnapshot = useMemo(() => {
    if (!activeVariant?.id) {
      return { averageUnitCost: null as number | null, totalPurchasedQuantity: 0, invoiceCount: 0 };
    }

    const matchedInvoices = purchaseInvoices.filter((invoice) => {
      if (!invoice || invoice.status === 'cancelled') return false;
      return invoice.product_variant_id === activeVariant.id;
    });

    const totals = matchedInvoices.reduce(
      (accumulator, invoice) => {
        const quantity = Number(invoice.quantity_purchased ?? invoice.requested_quantity ?? 0);
        const unitCost = Number(invoice.unit_cost ?? 0);

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return accumulator;
        }

        return {
          totalPurchasedQuantity: accumulator.totalPurchasedQuantity + quantity,
          totalCost: accumulator.totalCost + (quantity * unitCost),
          invoiceCount: accumulator.invoiceCount + 1,
        };
      },
      { totalPurchasedQuantity: 0, totalCost: 0, invoiceCount: 0 }
    );

    return {
      averageUnitCost: totals.totalPurchasedQuantity > 0 ? totals.totalCost / totals.totalPurchasedQuantity : null,
      totalPurchasedQuantity: totals.totalPurchasedQuantity,
      invoiceCount: totals.invoiceCount,
    };
  }, [activeVariant?.id, purchaseInvoices]);

  const numericQuantity = Number(quantity);
  const numericUnitPrice = Number(unitPrice);
  const numericVatRate = Number(vatRate || 0);
  const subtotal = Number.isFinite(numericQuantity) && Number.isFinite(numericUnitPrice) ? numericQuantity * numericUnitPrice : 0;
  const vatAmount = subtotal * (numericVatRate / 100);
  const totalAmount = subtotal + vatAmount;

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedVariantId('');
    setSelectedWarehouseId('');
    setUnitPrice('');
  };

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    setSelectedWarehouseId('');
    const variant = productVariants.find((entry) => entry.id === variantId);
    if (variant && Number.isFinite(Number(variant.unit_price))) {
      setUnitPrice(String(Number(variant.unit_price)));
    }
  };

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!selectedClientId) errors.push('Customer is required.');
    if (!selectedProductId) errors.push('Product is required.');
    if (!selectedVariantId) errors.push('Variant is required.');
    if (!activeVariant) errors.push('The selected variant is not valid.');
    if (!selectedWarehouseId) errors.push('Warehouse is required.');
    if (activeVariant && warehousesWithStock.length === 0) errors.push('No warehouse currently has this variant in stock.');
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) errors.push('Quantity must be greater than zero.');
    if (numericQuantity > availableQuantity) errors.push('Not enough stock in the selected warehouse.');
    if (!Number.isFinite(numericUnitPrice) || numericUnitPrice < 0) errors.push('Sell price must be zero or greater.');
    if (!Number.isFinite(numericVatRate) || numericVatRate < 0) errors.push('VAT must be valid.');
    return Array.from(new Set(errors));
  }, [
    activeVariant,
    availableQuantity,
    numericQuantity,
    numericUnitPrice,
    numericVatRate,
    selectedClientId,
    selectedProductId,
    selectedVariantId,
    selectedWarehouseId,
    warehousesWithStock.length,
  ]);

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedWarehouseId('');
    setQuantity('');
    setUnitPrice('');
    setVatRate('0');
    setNotes('');
    setTransactionTime(new Date().toISOString());
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient || !selectedProduct || !activeVariant || !selectedWarehouse || validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    setIsProcessing(true);
    try {
      const idempotencyKey = `SELL-${Date.now()}`;
      if (isDemoMode) {
        issueDemoStock(
          activeVariant.id,
          selectedWarehouse.id,
          numericQuantity,
          selectedClient.name,
          selectedClient.id,
          numericUnitPrice,
          {
            vatRate: numericVatRate,
            notes: notes || `Sold stock to ${selectedClient.name}`,
            transactionTime,
          }
        );
      } else {
        await InventoryService.issueStock(
          activeVariant.id,
          selectedWarehouse.id,
          numericQuantity,
          selectedClient.name,
          idempotencyKey,
          {
            clientId: selectedClient.id,
            unitPrice: numericUnitPrice,
            vatRate: numericVatRate,
            notes: notes || `Sold stock to ${selectedClient.name}`,
            transactionTime,
          }
        );
      }

      toast.success('Sell transaction recorded.');
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to process sell transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  const formComplete = validationErrors.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 px-8 py-6 shadow-lg shadow-indigo-200">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-24 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <ShoppingCart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Sell to Customer</h1>
            <p className="mt-0.5 text-sm text-indigo-100">
              Record outgoing stock sold from your warehouse to a customer.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_380px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Customer</h2>
            </div>
            <FieldGroup label="Select customer" icon={User}>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={selectCls}
              >
                <option value="">— Choose customer —</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Product</h2>
            </div>
            <div className="space-y-4">
              <FieldGroup label="Product" icon={Package}>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— Choose product —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup label="Variant" icon={Tag}>
                <select
                  value={selectedVariantId}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  className={selectCls}
                  disabled={!selectedProductId}
                >
                  <option value="">— Choose variant —</option>
                  {productVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.variant_code || variant.barcode}</option>
                  ))}
                </select>
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

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                <WarehouseIcon className="h-4 w-4 text-sky-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Warehouse & Pricing</h2>
            </div>
            <div className="space-y-4">
              <FieldGroup label="Source warehouse" icon={WarehouseIcon}>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className={selectCls}
                  disabled={!activeVariant || warehousesWithStock.length === 0}
                >
                  <option value="">— Choose warehouse —</option>
                  {warehousesWithStock.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.availableQuantity} available)
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                Available stock in selected warehouse: <span className="font-bold">{availableQuantity}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FieldGroup label="Quantity" icon={Hash}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputCls}
                    placeholder="0"
                  />
                </FieldGroup>
                <FieldGroup label="Sell price per unit" icon={DollarSign}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Average buy cost:{' '}
                    <span className="font-semibold text-slate-700">
                      {averageBuySnapshot.averageUnitCost === null ? '—' : `$${averageBuySnapshot.averageUnitCost.toFixed(2)}`}
                    </span>
                  </p>
                </FieldGroup>
                <FieldGroup label="VAT %" icon={DollarSign}>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className={selectCls}
                  >
                    {VAT_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <FieldGroup label="Notes" icon={FileText}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={textareaCls}
                placeholder="Optional internal notes about this sell transaction…"
              />
            </FieldGroup>
          </div>

          {validationErrors.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">{validationErrors[0]}</p>
            </div>
          )}

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
                  Confirm Sell
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

        <aside className="space-y-5">
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
                  ['Average buy cost', averageBuySnapshot.averageUnitCost === null ? '—' : `$${averageBuySnapshot.averageUnitCost.toFixed(2)}`],
                  ['Bought quantity', averageBuySnapshot.totalPurchasedQuantity ? String(averageBuySnapshot.totalPurchasedQuantity) : '—'],
                  ['Buy invoices', averageBuySnapshot.invoiceCount ? String(averageBuySnapshot.invoiceCount) : '—'],
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
                <SummaryRow label="Unit price" value={`$${numericUnitPrice.toFixed(2)}`} />
                <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
                <SummaryRow label="VAT" value={`$${vatAmount.toFixed(2)}`} />
                <SummaryRow label="Total Amount" value={`$${totalAmount.toFixed(2)}`} highlight />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-xs leading-relaxed text-sky-700">
              <span className="font-bold">Sale flow:</span> this transaction reduces available stock from the selected warehouse and creates the client invoice for the sold items.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
