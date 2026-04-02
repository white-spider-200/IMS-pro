import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Package,
  Search,
  ShoppingCart,
  Truck,
  User,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import InventoryService from '../services/inventoryService';
import { useDemoMode } from '../demo/demoMode';
import { processDemoBuyOrder } from '../demo/demoDatabase';

type BuySellPanelProps = {
  clients: any[];
  products: any[];
  variants: any[];
  warehouses: any[];
  suppliers: any[];
  balances: any[];
  embedded?: boolean;
};

const VAT_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: 'other', label: 'Other' },
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export default function BuySellPanel({
  clients,
  products,
  variants,
  warehouses,
  suppliers,
  balances,
  embedded = false,
}: BuySellPanelProps) {
  const isDemoMode = useDemoMode();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState<number>(0);
  const [warehouseAllocations, setWarehouseAllocations] = useState<Record<string, number>>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierReceivingWarehouseId, setSupplierReceivingWarehouseId] = useState('');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [vatSelection, setVatSelection] = useState('');
  const [customVat, setCustomVat] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId]
  );

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const query = productSearch.toLowerCase();
    return products
      .filter((product) => {
        const name = String(product.name || '').toLowerCase();
        const sku = String(product.sku || '').toLowerCase();
        return name.includes(query) || sku.includes(query);
      })
      .slice(0, 6);
  }, [productSearch, products]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const productVariants = useMemo(
    () => variants.filter((variant) => variant.product_id === selectedProductId),
    [selectedProductId, variants]
  );

  const activeVariant = useMemo(() => productVariants[0] || null, [productVariants]);

  const variantLabel = useMemo(() => {
    if (!activeVariant) return '';
    return activeVariant.variant_code || activeVariant.barcode || '';
  }, [activeVariant]);

  const productBalances = useMemo(
    () => balances.filter((balance) => (activeVariant ? balance.variant_id === activeVariant.id : false)),
    [activeVariant, balances]
  );

  const warehouseAvailability = useMemo(() => {
    return warehouses
      .map((warehouse) => {
        const balance = productBalances.find((entry) => entry.warehouse_id === warehouse.id);
        return {
          ...warehouse,
          availableQuantity: Number(balance?.available_quantity || 0),
        };
      })
      .sort((left, right) => right.availableQuantity - left.availableQuantity);
  }, [productBalances, warehouses]);

  const warehouseById = useMemo(
    () => new Map(warehouseAvailability.map((warehouse) => [warehouse.id, warehouse])),
    [warehouseAvailability]
  );

  useEffect(() => {
    setWarehouseAllocations((current) => {
      if (!selectedProductId || requestedQuantity <= 0) return {};

      let remaining = requestedQuantity;
      const next: Record<string, number> = {};

      for (const [warehouseId, rawQuantity] of Object.entries(current)) {
        const warehouse = warehouseById.get(warehouseId);
        if (!warehouse) continue;
        const clamped = Math.max(0, Math.min(Number(rawQuantity || 0), warehouse.availableQuantity, remaining));
        if (clamped > 0) {
          next[warehouseId] = clamped;
          remaining -= clamped;
        }
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      const isSame =
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key) => Number(current[key] || 0) === Number(next[key] || 0));

      return isSame ? current : next;
    });
  }, [requestedQuantity, selectedProductId, warehouseById]);

  const totalAvailableQuantity = useMemo(
    () => warehouseAvailability.reduce((sum, warehouse) => sum + warehouse.availableQuantity, 0),
    [warehouseAvailability]
  );

  const warehouseAllocationEntries = useMemo(() => {
    return Object.entries(warehouseAllocations)
      .map(([warehouseId, quantity]) => ({
        warehouseId,
        quantity: Number(quantity || 0),
        warehouse: warehouseById.get(warehouseId),
      }))
      .filter((entry) => entry.warehouse && entry.quantity > 0);
  }, [warehouseAllocations, warehouseById]);

  const quantityFromWarehouse = useMemo(
    () => warehouseAllocationEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    [warehouseAllocationEntries]
  );

  const quantityFromSupplier = useMemo(
    () => Math.max(0, requestedQuantity - quantityFromWarehouse),
    [quantityFromWarehouse, requestedQuantity]
  );

  const stockCase = useMemo(() => {
    if (!selectedProduct || requestedQuantity <= 0) return null;
    if (totalAvailableQuantity <= 0) return 'none';
    if (warehouseAvailability.some((warehouse) => warehouse.availableQuantity >= requestedQuantity)) return 'single';
    return 'partial';
  }, [requestedQuantity, selectedProduct, totalAvailableQuantity, warehouseAvailability]);

  const supplierOptions = useMemo(() => {
    const preferredSupplierId = selectedProduct?.supplier_id;
    return [...suppliers].sort((left, right) => {
      if (left.id === preferredSupplierId) return -1;
      if (right.id === preferredSupplierId) return 1;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });
  }, [selectedProduct?.supplier_id, suppliers]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (selectedProduct.supplier_id && supplierOptions.some((supplier) => supplier.id === selectedProduct.supplier_id)) {
      setSelectedSupplierId((current) => current || selectedProduct.supplier_id);
    }
  }, [selectedProduct, supplierOptions]);

  useEffect(() => {
    if (quantityFromSupplier <= 0) return;
    if (supplierReceivingWarehouseId) return;
    if (warehouseAllocationEntries.length === 1) {
      setSupplierReceivingWarehouseId(warehouseAllocationEntries[0].warehouseId);
      return;
    }
    if (warehouseAllocationEntries.length > 1) {
      setSupplierReceivingWarehouseId(warehouseAllocationEntries[0].warehouseId);
      return;
    }
    if (warehouseAvailability[0]?.id) {
      setSupplierReceivingWarehouseId(warehouseAvailability[0].id);
    }
  }, [quantityFromSupplier, supplierReceivingWarehouseId, warehouseAllocationEntries, warehouseAvailability]);

  const selectedSupplier = useMemo(
    () => supplierOptions.find((supplier) => supplier.id === selectedSupplierId),
    [selectedSupplierId, supplierOptions]
  );

  const receivingWarehouse = useMemo(
    () => warehouseAvailability.find((warehouse) => warehouse.id === supplierReceivingWarehouseId),
    [supplierReceivingWarehouseId, warehouseAvailability]
  );

  const effectiveVatRate = useMemo(() => {
    if (vatSelection === '') return null;
    if (vatSelection === 'other') {
      const parsed = Number(customVat);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(vatSelection);
    return Number.isFinite(parsed) ? parsed : null;
  }, [customVat, vatSelection]);

  const subtotal = quantityFromSupplier * unitCost;
  const vatAmount = subtotal * ((effectiveVatRate || 0) / 100);
  const totalCost = subtotal + vatAmount;

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!selectedClientId) errors.push('Client is required.');
    if (!selectedProductId) errors.push('Product is required.');
    if (!activeVariant) errors.push('The selected product has no linked variant to transact.');
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      errors.push('Quantity must be greater than zero.');
    }

    for (const entry of warehouseAllocationEntries) {
      if (!entry.warehouse) continue;
      if (entry.quantity > entry.warehouse.availableQuantity) {
        errors.push(`Warehouse allocation exceeds availability in ${entry.warehouse.name}.`);
      }
    }

    if (quantityFromWarehouse > requestedQuantity) {
      errors.push('Warehouse allocation cannot exceed the requested quantity.');
    }

    if (!selectedSupplierId) {
      errors.push('Supplier selection is required for this transaction.');
    }

    if (quantityFromSupplier > 0) {
      if (supplierOptions.length === 0) errors.push('Product not available in warehouses or suppliers.');
      if (!Number.isFinite(unitCost) || unitCost <= 0) errors.push('Unit cost must be entered for the supplier.');
      if (effectiveVatRate === null || effectiveVatRate < 0) errors.push('VAT must always be selected.');
    }

    return Array.from(new Set(errors));
  }, [
    activeVariant,
    effectiveVatRate,
    quantityFromSupplier,
    quantityFromWarehouse,
    requestedQuantity,
    selectedClientId,
    selectedProductId,
    selectedSupplierId,
    supplierOptions.length,
    supplierReceivingWarehouseId,
    unitCost,
    warehouseAllocationEntries,
  ]);

  const canReview = validationErrors.length === 0;

  const clearFlow = () => {
    setSelectedClientId('');
    setProductSearch('');
    setSelectedProductId('');
    setRequestedQuantity(0);
    setWarehouseAllocations({});
    setSelectedSupplierId('');
    setSupplierReceivingWarehouseId('');
    setUnitCost(0);
    setVatSelection('');
    setCustomVat('');
    setIsReviewing(false);
  };

  const resetFulfillmentState = () => {
    setRequestedQuantity(0);
    setWarehouseAllocations({});
    setSelectedSupplierId('');
    setSupplierReceivingWarehouseId('');
    setUnitCost(0);
    setVatSelection('');
    setCustomVat('');
    setIsReviewing(false);
  };

  const handleWarehouseAllocationChange = (warehouseId: string, value: string) => {
    const warehouse = warehouseById.get(warehouseId);
    if (!warehouse) return;

    const parsed = Math.max(0, Number.parseInt(value || '0', 10) || 0);
    const otherAllocated = Object.entries(warehouseAllocations).reduce((sum, [currentWarehouseId, quantity]) => {
      if (currentWarehouseId === warehouseId) return sum;
      return sum + Number(quantity || 0);
    }, 0);
    const maxAllowed = Math.max(0, Math.min(warehouse.availableQuantity, requestedQuantity - otherAllocated));
    const nextQuantity = Math.min(parsed, maxAllowed);

    setWarehouseAllocations((current) => {
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[warehouseId];
        return next;
      }
      return {
        ...current,
        [warehouseId]: nextQuantity,
      };
    });
  };

  const handleConfirm = async () => {
    if (!selectedProduct || !activeVariant || !selectedClient || !canReview) return;

    const payload = {
      variantId: activeVariant.id,
      productId: selectedProduct.id,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      requestedQuantity,
      warehouseAllocations: warehouseAllocationEntries.map((entry) => ({
        warehouseId: entry.warehouseId,
        quantity: entry.quantity,
      })),
      supplierId: selectedSupplierId,
      supplierQuantity: quantityFromSupplier,
      receivingWarehouseId: quantityFromSupplier > 0 ? supplierReceivingWarehouseId : null,
      unitCost: quantityFromSupplier > 0 ? unitCost : 0,
      vatRate: quantityFromSupplier > 0 ? effectiveVatRate || 0 : 0,
      idempotencyKey: `BUY-${Date.now()}`,
    };

    setIsProcessing(true);
    try {
      if (isDemoMode) {
        processDemoBuyOrder(payload);
      } else {
        await InventoryService.processBuyOrder(payload);
      }

      toast.success('Buy transaction processed successfully.');
      clearFlow();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to process buy transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isReviewing) {
    return (
      <aside className={cn(
        'space-y-5 flex flex-col h-full overflow-y-auto',
        embedded ? 'w-full p-6 md:p-8' : 'w-80 border-l p-5'
      )}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReviewing(false)}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">Final Review</h2>
            <p className="text-xs text-gray-500">Validate the warehouse and supplier breakdown before confirmation.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">General</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900">Client:</span> {selectedClient?.name}</p>
            <p><span className="font-semibold text-gray-900">Product:</span> {selectedProduct?.name}</p>
            {variantLabel && <p><span className="font-semibold text-gray-900">Variant:</span> {variantLabel}</p>}
            <p><span className="font-semibold text-gray-900">Total requested quantity:</span> {requestedQuantity}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Warehouse Section</h3>
          {warehouseAllocationEntries.length > 0 ? (
            <div className="space-y-2">
              {warehouseAllocationEntries.map((entry) => (
                <div key={entry.warehouseId} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">{entry.warehouse?.name}</p>
                  <p className="text-xs text-gray-500">Quantity taken from warehouse: {entry.quantity}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No warehouse stock is being used for this request.</p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Supplier Section</h3>
          {quantityFromSupplier > 0 ? (
            <div className="text-sm text-gray-700 space-y-1.5">
              <p><span className="font-semibold text-gray-900">Supplier:</span> {selectedSupplier?.name}</p>
              <p><span className="font-semibold text-gray-900">Quantity supplied:</span> {quantityFromSupplier}</p>
              <p><span className="font-semibold text-gray-900">Receive into:</span> {receivingWarehouse?.name}</p>
              <p><span className="font-semibold text-gray-900">Unit cost:</span> {formatCurrency(unitCost)}</p>
              <p><span className="font-semibold text-gray-900">VAT:</span> {effectiveVatRate}%</p>
              <p><span className="font-semibold text-gray-900">Subtotal:</span> {formatCurrency(subtotal)}</p>
              <p><span className="font-semibold text-gray-900">VAT amount:</span> {formatCurrency(vatAmount)}</p>
              <p><span className="font-semibold text-gray-900">Total cost:</span> {formatCurrency(totalCost)}</p>
              <p><span className="font-semibold text-gray-900">Delivery method:</span> Supplier to warehouse</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No supplier sourcing is required. This request is covered by warehouse stock.</p>
          )}
        </section>

        {validationErrors.length > 0 && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-rose-500">Validation</h3>
            <div className="space-y-1">
              {validationErrors.map((error) => (
                <p key={error} className="text-xs text-rose-700">{error}</p>
              ))}
            </div>
          </section>
        )}

        <div className="mt-auto space-y-3">
          <button
            onClick={handleConfirm}
            disabled={!canReview || isProcessing}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Confirm Buy Transaction'}
          </button>
          <button
            onClick={() => setIsReviewing(false)}
            className="w-full border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Edit
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn(
      'space-y-6 flex flex-col h-full overflow-y-auto',
      embedded ? 'w-full p-6 md:p-8' : 'w-80 border-l p-5'
    )}>
      <div className="space-y-1">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">Buy Module</h2>
        <p className="text-xs text-gray-500">Warehouse-aware sourcing with strict supplier cost validation.</p>
      </div>

      <section className="space-y-3">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <User className="w-3 h-3" />
          1. Select Client
        </label>
        <select
          value={selectedClientId}
          onChange={(event) => setSelectedClientId(event.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        >
          <option value="">Choose a client...</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Package className="w-3 h-3" />
          2. Find Product
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search SKU or name..."
            value={productSearch}
            onChange={(event) => {
              setProductSearch(event.target.value);
              if (selectedProductId) {
                setSelectedProductId('');
                resetFulfillmentState();
              }
            }}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        {filteredProducts.length > 0 && !selectedProductId && (
          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProductId(product.id);
                  setProductSearch(product.name);
                  resetFulfillmentState();
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <p className="font-bold text-gray-800">{product.name}</p>
                <p className="text-[10px] text-gray-400">{product.sku}</p>
              </button>
            ))}
          </div>
        )}

        {selectedProduct && (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between gap-3 items-start">
            <div>
              <p className="text-xs font-bold text-emerald-900">{selectedProduct.name}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">SKU: {selectedProduct.sku}</p>
              {variantLabel && <p className="text-[10px] text-emerald-600 mt-0.5">Variant: {variantLabel}</p>}
            </div>
            <button
              onClick={() => {
                setSelectedProductId('');
                setProductSearch('');
                resetFulfillmentState();
              }}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <AlertCircle className="w-3 h-3" />
            </button>
          </div>
        )}
      </section>

      {selectedProduct ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <section className="space-y-3">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3 h-3" />
              3. Requested Quantity
            </label>
            <input
              type="number"
              min="1"
              placeholder="Enter quantity..."
              value={requestedQuantity || ''}
              onChange={(event) => setRequestedQuantity(Math.max(0, Number.parseInt(event.target.value || '0', 10) || 0))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </section>

          {requestedQuantity > 0 && (
            <section className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <WarehouseIcon className="w-3 h-3" />
                4. Warehouse Availability
              </label>

              <div
                className={cn(
                  'rounded-2xl border px-3 py-3 text-xs',
                  stockCase === 'single' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  stockCase === 'partial' && 'border-amber-200 bg-amber-50 text-amber-800',
                  stockCase === 'none' && 'border-rose-200 bg-rose-50 text-rose-700'
                )}
              >
                {stockCase === 'single' && (
                  <p>A single warehouse can cover this request. You can allocate from one warehouse or split it manually.</p>
                )}
                {stockCase === 'partial' && (
                  <p>
                    {totalAvailableQuantity} units are available in warehouses. {quantityFromSupplier} units still need supplier sourcing.
                  </p>
                )}
                {stockCase === 'none' && <p>No stock is available in warehouses.</p>}
              </div>

              {stockCase !== 'none' && (
                <div className="space-y-2">
                  {warehouseAvailability.map((warehouse) => {
                    const allocated = Number(warehouseAllocations[warehouse.id] || 0);
                    const otherAllocated = quantityFromWarehouse - allocated;
                    const maxAllowed = Math.max(0, Math.min(warehouse.availableQuantity, requestedQuantity - otherAllocated));

                    return (
                      <div
                        key={warehouse.id}
                        className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{warehouse.name}</p>
                            <p className="text-[10px] text-gray-500">{warehouse.availableQuantity} units available</p>
                          </div>
                          {allocated > 0 && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={maxAllowed}
                            value={allocated || ''}
                            onChange={(event) => handleWarehouseAllocationChange(warehouse.id, event.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0"
                          />
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap">
                            Max {maxAllowed}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {requestedQuantity > 0 && (
            <section className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-3 h-3" />
                5. Warehouse vs Supplier Split
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                  <p className="text-gray-400 uppercase tracking-widest text-[10px] font-bold">From Warehouses</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{quantityFromWarehouse}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                  <p className="text-gray-400 uppercase tracking-widest text-[10px] font-bold">From Supplier</p>
                  <p className="mt-1 text-xl font-black text-indigo-700">{quantityFromSupplier}</p>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">6. Supplier</p>
            </div>

            {supplierOptions.length === 0 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                Product not available in warehouses or suppliers
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <span>Supplier</span>
                  <span>Qty To Use</span>
                  <span>Unit Cost</span>
                  <span>VAT</span>
                  <span>VAT Cost</span>
                  <span>Select</span>
                </div>
                {supplierOptions.map((supplier) => {
                  const isSelected = supplier.id === selectedSupplierId;
                  return (
                    <div
                      key={supplier.id}
                      className={cn(
                        'grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-2 px-3 py-3 text-xs border-b border-gray-100 last:border-b-0 items-center',
                        isSelected && 'bg-indigo-50'
                      )}
                    >
                      <div>
                        <p className="font-bold text-gray-900">{supplier.name}</p>
                        <p className="text-[10px] text-gray-500">{supplier.country || 'Supplier'}</p>
                      </div>
                      <div className="font-semibold text-gray-900">{quantityFromSupplier}</div>
                      <div>
                        {isSelected && quantityFromSupplier > 0 ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={unitCost || ''}
                            onChange={(event) => setUnitCost(Math.max(0, Number.parseFloat(event.target.value || '0') || 0))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-gray-400">{isSelected ? formatCurrency(unitCost) : '-'}</span>
                        )}
                      </div>
                      <div>
                        {isSelected && quantityFromSupplier > 0 ? (
                          <div className="space-y-1">
                            <select
                              value={vatSelection}
                              onChange={(event) => setVatSelection(event.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">Select</option>
                              {VAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {vatSelection === 'other' && (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customVat}
                                onChange={(event) => setCustomVat(event.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="%"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">{isSelected && effectiveVatRate !== null ? `${effectiveVatRate}%` : '-'}</span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900">
                        {isSelected && quantityFromSupplier > 0 ? formatCurrency(vatAmount) : '-'}
                      </div>
                      <div>
                        <button
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          className={cn(
                            'rounded-xl px-3 py-1.5 font-semibold transition-colors',
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          {isSelected ? 'Selected' : 'Use'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {quantityFromSupplier > 0 && selectedSupplierId && (
                  <div className="grid grid-cols-2 gap-2 px-3 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                    <p className="text-gray-500">Total Cost</p>
                    <p className="text-right font-bold text-indigo-700">{formatCurrency(totalCost)}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {validationErrors.length > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 space-y-1">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Validation</p>
              </div>
              {validationErrors.map((error) => (
                <p key={error} className="text-xs text-rose-700">{error}</p>
              ))}
            </section>
          )}

          <button
            onClick={() => setIsReviewing(true)}
            disabled={!canReview}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Review Order
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-gray-400">Select a client and product to begin the buy flow.</div>
      )}
    </aside>
  );
}
