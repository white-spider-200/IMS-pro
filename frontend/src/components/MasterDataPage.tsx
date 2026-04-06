import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Filter, Package, Warehouse as WarehouseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { sanitizeMoney, sanitizeQuantity } from '../lib/financialGuards';
import AutocompleteSearch from './AutocompleteSearch';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { removeDemoCollectionItem, saveDemoCollectionItem } from '../demo/demoDatabase';
import { api } from '../lib/api';
import { useSSE } from '../lib/useSSE';
import { getToken } from '../lib/localAuth';

interface MasterDataProps {
  collectionName: string;
  title: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'image';
    options?: { label: string; value: string }[];
    required?: boolean;
    readOnly?: boolean;
    hideInTable?: boolean;
    hideInDetails?: boolean;
    hideInForm?: boolean;
    clickable?: boolean;
    getDisplayValue?: (item: any) => string;
  }[];
  sortField?: string;
  uniqueField?: string;
  uniqueFields?: string[];
  onView?: (item: any) => void;
  hideStatus?: boolean;
  hardDelete?: boolean;
}

const normalizeUniqueValue = (fieldKey: string, value: unknown) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';

  const normalizedKey = fieldKey.toLowerCase();
  if (normalizedKey.includes('email')) {
    return rawValue.toLowerCase();
  }

  if (normalizedKey.includes('phone') || normalizedKey.includes('number')) {
    return rawValue.replace(/\D/g, '');
  }

  return rawValue.toLowerCase();
};

const createSupplierCode = (existingSuppliers: any[]) => {
  let code = '';
  const existingCodes = new Set(existingSuppliers.map((supplier) => String(supplier.supplier_code || '').trim()));

  do {
    code = `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  } while (existingCodes.has(code));

  return code;
};

const normalizeWarehousePayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return payload;

  const managerId = typeof payload.manager_id === 'string' ? payload.manager_id.trim() : '';
  if (!managerId) {
    return {
      ...payload,
      manager_id: '',
    };
  }

  return {
    ...payload,
    manager_id: managerId,
    manual_manager_name: '',
    manual_manager_phone: '',
    manual_manager_email: '',
  };
};

export default function MasterDataPage({
  collectionName,
  title,
  fields,
  sortField = 'name',
  uniqueField,
  uniqueFields,
  onView,
  hideStatus = false,
  hardDelete = false,
}: MasterDataProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [productLookups, setProductLookups] = useState<{
    brands: any[];
    categories: any[];
    suppliers: any[];
  }>({ brands: [], categories: [], suppliers: [] });
  const [selectedRelatedProduct, setSelectedRelatedProduct] = useState<any>(null);

  const outletContext = useOutletContext<any>() || {};
  const {
    isDemoMode,
    balances = [],
    variants = [],
    warehouses = [],
    products: ctxProducts = [],
    brands: ctxBrands = [],
    categories: ctxCategories = [],
    suppliers: ctxSuppliers = [],
    clients: ctxClients = [],
    movements = [],
    revenueInvoices = [],
    purchaseInvoices = [],
    transfers = [],
    handleVariantClick,
    user
  } = outletContext;

  const [isEditingManagerInfo, setIsEditingManagerInfo] = useState(false);
  const [managerFormData, setManagerFormData] = useState({ phone: '', email: '' });

  const handleManagerInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingItem || collectionName !== 'warehouses') return;
    if (viewingItem.manager_id) {
      toast.info('This warehouse uses a system manager. Update contact details from the user profile instead.');
      setIsEditingManagerInfo(false);
      return;
    }

    const updates = {
      manual_manager_phone: managerFormData.phone,
      manual_manager_email: managerFormData.email,
    };

    try {
      if (isDemoMode) {
        saveDemoCollectionItem('warehouses', { ...viewingItem, ...updates });
      } else {
        await api.collection.update('warehouses', viewingItem.id, updates);
      }
      setViewingItem({ ...viewingItem, ...updates });
      toast.success('Manager info updated successfully');
      setIsEditingManagerInfo(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update manager info');
    }
  };

  const demoDataMap: Record<string, any[]> = {
    brands: ctxBrands,
    categories: ctxCategories,
    suppliers: ctxSuppliers,
    clients: ctxClients,
    warehouses: warehouses,
    products: ctxProducts,
    product_variants: variants,
  };

  const effectiveUniqueFields = useMemo(() => {
    if (uniqueFields && uniqueFields.length > 0) return uniqueFields;
    if (uniqueField) return [uniqueField];
    return [];
  }, [uniqueField, uniqueFields]);

  const shouldLoadRelatedProducts = collectionName === 'brands' || collectionName === 'categories';
  const tableFields = useMemo(() => fields.filter((field) => !field.hideInTable), [fields]);
  const detailFields = useMemo(() => fields.filter((field) => !field.hideInDetails), [fields]);
  const formFields = useMemo(() => fields.filter((field) => !field.hideInForm), [fields]);
  const primaryClickableField = useMemo(() => {
    const explicitClickableField = tableFields.find((field) => field.clickable);
    if (explicitClickableField) return explicitClickableField.key;
    const preferredKeys = ['name', 'variant_code', 'sku'];
    return preferredKeys.find((key) => tableFields.some((field) => field.key === key)) || null;
  }, [tableFields]);

  const fetchData = useCallback(async () => {
    if (isDemoMode) {
      setData(demoDataMap[collectionName] || []);
      setLoading(false);
      return;
    }
    if (!getToken()) return;
    try {
      const items = await api.collection.getAll(collectionName);
      setData(items);
    } catch (e: any) {
      toast.error(`Failed to load ${collectionName}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [collectionName, isDemoMode]);

  // SSE: re-fetch when this collection changes
  useSSE((col) => { if (col === collectionName) fetchData(); }, !!getToken() && !isDemoMode);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isDemoMode) { setRelatedProducts(ctxProducts); return; }
    if (!shouldLoadRelatedProducts || !getToken()) { setRelatedProducts([]); return; }
    api.collection.getAll('products').then(setRelatedProducts).catch(() => { });
  }, [shouldLoadRelatedProducts, isDemoMode, ctxProducts]);

  useEffect(() => {
    if (isDemoMode) { setProductLookups({ brands: ctxBrands, categories: ctxCategories, suppliers: ctxSuppliers }); return; }
    if (!shouldLoadRelatedProducts || !getToken()) { setProductLookups({ brands: [], categories: [], suppliers: [] }); return; }
    Promise.all([
      api.collection.getAll('brands'),
      api.collection.getAll('categories'),
      api.collection.getAll('suppliers'),
    ]).then(([b, c, s]) => setProductLookups({ brands: b, categories: c, suppliers: s })).catch(() => { });
  }, [shouldLoadRelatedProducts, isDemoMode, ctxBrands, ctxCategories, ctxSuppliers]);

  const getSelectLabel = (field: MasterDataProps['fields'][number], value: string) => {
    return field.options?.find((option) => option.value === value)?.label || value;
  };

  const getFieldDisplayValue = (field: MasterDataProps['fields'][number], item: any) => {
    if (field.getDisplayValue) return field.getDisplayValue(item);
    if (field.type === 'select') return getSelectLabel(field, item[field.key]);
    return item[field.key];
  };

  const getWarehouseManagerSummary = (warehouse: any) => {
    const managerField = fields.find((field) => field.key === 'manager_id');
    const systemManager = managerField?.options?.find((option) => option.value === warehouse.manager_id) as any;

    if (systemManager) {
      return {
        name: systemManager.label,
        phone: systemManager.phone || 'N/A',
        email: systemManager.email || 'N/A',
        sourceMessage: 'This manager is assigned in the system.',
      };
    }

    return {
      name: warehouse.manual_manager_name || 'No manager assigned',
      phone: warehouse.manual_manager_phone || 'N/A',
      email: warehouse.manual_manager_email || 'N/A',
      sourceMessage: 'This manager uses manual data.',
    };
  };

  const relatedProductsForViewingItem = useMemo(() => {
    if (!viewingItem || !shouldLoadRelatedProducts) return [];

    return relatedProducts.filter((product) => {
      if (collectionName === 'brands') return product.brand_id === viewingItem.id;
      if (collectionName === 'categories') return product.category_id === viewingItem.id;
      return false;
    });
  }, [collectionName, relatedProducts, shouldLoadRelatedProducts, viewingItem]);

  const clientActivityForViewingItem = useMemo(() => {
    if (!viewingItem || collectionName !== 'clients') return [];

    return transfers
      .filter((transfer: any) => {
        if (!['buy', 'sell', 'buy_order'].includes(String(transfer.transfer_type || ''))) return false;
        if (viewingItem.id && transfer.client_id === viewingItem.id) return true;
        const clientName = String(viewingItem.name || '').trim().toLowerCase();
        return clientName && String(transfer.customer_name || '').trim().toLowerCase() === clientName;
      })
      .map((transfer: any) => {
        const linkedMovement = movements.find((movement: any) =>
          movement.id === transfer.movement_id ||
          movement.id === transfer.movement_in_id ||
          movement.id === transfer.movement_out_id
        );
        const linkedInvoice = transfer.revenue_invoice_id
          ? revenueInvoices.find((invoice: any) => invoice.id === transfer.revenue_invoice_id)
          : transfer.purchase_invoice_id
            ? purchaseInvoices.find((invoice: any) => invoice.id === transfer.purchase_invoice_id)
            : null;
        const warehouseName = getWarehouseName(
          transfer.warehouse_id || linkedInvoice?.warehouse_id || linkedInvoice?.receiving_warehouse_id
        );
        const totalQuantity = sanitizeQuantity(
          transfer.quantity
          ?? linkedInvoice?.quantity_purchased
          ?? linkedInvoice?.requested_quantity
          ?? (Array.isArray(linkedInvoice?.items)
            ? linkedInvoice.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
            : 0)
        );

        return {
          ...transfer,
          invoice_number: linkedInvoice?.invoice_number || 'N/A',
          total_amount: sanitizeMoney(transfer.total_amount ?? linkedInvoice?.total_amount ?? linkedInvoice?.total_cost ?? 0),
          status: transfer.status || linkedInvoice?.status || 'N/A',
          linkedMovement,
          linkedInvoice,
          warehouseName,
          totalQuantity,
          transferTypeLabel: transfer.transfer_type === 'sell' ? 'sell' : 'buy',
        };
      })
      .sort((a: any, b: any) => {
        const aTime = new Date(a.created_at || a.timestamp || 0).getTime();
        const bTime = new Date(b.created_at || b.timestamp || 0).getTime();
        return bTime - aTime;
      });
  }, [collectionName, getWarehouseName, movements, purchaseInvoices, revenueInvoices, transfers, viewingItem]);

  const supplierActivityForViewingItem = useMemo(() => {
    if (!viewingItem || collectionName !== 'suppliers') return [];

    const supplierProductIds = ctxProducts
      .filter((product) => product.supplier_id === viewingItem.id)
      .map((product) => product.id);
    const supplierVariantIds = variants
      .filter((variant) => supplierProductIds.includes(variant.product_id))
      .map((variant) => variant.id);

    return movements
      .filter((movement: any) => supplierVariantIds.includes(movement.variant_id))
      .map((movement: any) => {
        const variant = variants.find((entry: any) => entry.id === movement.variant_id);
        const product = ctxProducts.find((entry) => entry.id === variant?.product_id);

        return {
          ...movement,
          warehouseName: getWarehouseName(movement.warehouse_id),
          variantLabel: variant ? `${product?.name || 'Unknown Product'} / ${variant.variant_code || variant.barcode}` : 'N/A',
        };
      })
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 10);
  }, [collectionName, ctxProducts, getWarehouseName, movements, variants, viewingItem]);

  const childCategoriesForViewingItem = useMemo(() => {
    if (!viewingItem || collectionName !== 'categories') return [];
    return data.filter((category) => category.parent_category_id === viewingItem.id);
  }, [collectionName, data, viewingItem]);

  function getWarehouseName(id: string) {
    return warehouses.find((w: any) => w.id === id)?.name || id;
  }

  const openRelatedProductDetails = (product: any) => {
    const brand = productLookups.brands.find((item) => item.id === product.brand_id);
    const category = productLookups.categories.find((item) => item.id === product.category_id);
    const supplier = productLookups.suppliers.find((item) => item.id === product.supplier_id);

    const productVariants = variants.filter((v: any) => v.product_id === product.id);
    const distMap = balances
      .filter((b: any) => productVariants.some((v: any) => v.id === b.variant_id))
      .reduce((acc: any, b: any) => {
        if (!acc[b.warehouse_id]) {
          acc[b.warehouse_id] = { warehouse_id: b.warehouse_id, quantity: 0 };
        }
        acc[b.warehouse_id].quantity += b.available_quantity;
        return acc;
      }, {});

    setSelectedRelatedProduct({
      ...product,
      brand_name: brand?.name || 'N/A',
      category_name: category?.name || 'N/A',
      supplier_name: supplier?.name || 'N/A',
      variants: productVariants.map((v: any) => ({
        ...v,
        stock_total: balances.filter((b: any) => b.variant_id === v.id).reduce((sum: number, b: any) => sum + b.available_quantity, 0)
      })),
      distribution: Object.values(distMap)
    });
  };

  const openItemDetails = (item: any) => {
    if (onView) {
      onView(item);
      return;
    }
    setViewingItem(item);
  };

  const getDetailsRoute = (item: any) => {
    if (!item?.id) return null;

    switch (collectionName) {
      case 'clients':
        return `/clients/${item.id}/transfers`;
      case 'suppliers':
        return `/suppliers/${item.id}/transfers`;
      case 'warehouses':
        return `/warehouses/${item.id}/details`;
      case 'brands':
        return `/brands/${item.id}/details`;
      case 'categories':
        return `/categories/${item.id}/details`;
      case 'products':
        return `/products/${item.id}/details`;
      case 'product_variants':
        return `/variants/${item.id}/details`;
      default:
        return null;
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(collectionName === 'suppliers' ? { supplier_code: createSupplierCode(data) } : {});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDemoMode && !getToken()) {
      toast.error('You must be signed in to perform this action');
      return;
    }

    for (const fieldKey of effectiveUniqueFields) {
      if (!formData[fieldKey]) continue;

      const normalizedFormValue = normalizeUniqueValue(fieldKey, formData[fieldKey]);
      const isDuplicate = data.some((item) =>
        item.id !== editingId &&
        normalizeUniqueValue(fieldKey, item[fieldKey]) === normalizedFormValue
      );

      if (isDuplicate) {
        const fieldLabel = fields.find((field) => field.key === fieldKey)?.label || fieldKey;
        toast.error(`A ${title.toLowerCase()} with this ${fieldLabel.toLowerCase()} already exists.`);
        return;
      }
    }

    const supportsLastModified = collectionName === 'clients' || collectionName === 'inventory_balances';

    const rawPayload = {
      ...formData,
      ...(collectionName === 'suppliers' && !formData.supplier_code ? { supplier_code: createSupplierCode(data) } : {}),
      ...(supportsLastModified ? { last_modified: new Date().toISOString() } : {}),
    };
    const basePayload = collectionName === 'warehouses'
      ? normalizeWarehousePayload(rawPayload)
      : rawPayload;

    try {
      if (isDemoMode) {
        const payload = editingId
          ? { ...basePayload, id: editingId }
          : { ...basePayload, ...(hideStatus ? {} : { status: 'active' }), created_at: new Date().toISOString() };
        saveDemoCollectionItem(collectionName as any, payload);
        toast.success(`${title} ${editingId ? 'updated' : 'created'} successfully`);
      } else if (editingId) {
        await api.collection.update(collectionName, editingId, basePayload);
        toast.success(`${title} updated successfully`);
      } else {
        await api.collection.create(collectionName, {
          ...basePayload,
          ...(hideStatus ? {} : { status: 'active' }),
        });
        toast.success(`${title} created successfully`);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({});
    } catch (error: any) {
      console.error(error);
      let message = 'Operation failed';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.error;
      } catch (e) {
        message = error.message || message;
      }
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) {
      if (hardDelete) {
        removeDemoCollectionItem(collectionName as any, id);
      } else {
        const currentItem = data.find((item) => item.id === id);
        if (currentItem) saveDemoCollectionItem(collectionName as any, { ...currentItem, status: 'inactive' });
      }
      toast.success(`${title} ${hardDelete ? 'deleted' : 'deactivated'}`);
      return;
    }
    try {
      await api.collection.remove(collectionName, id);
      toast.success(`${title} ${hardDelete ? 'deleted' : 'deactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    }
  };
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Parse advanced filters: label:"value"
    const fieldIdentifiers = fields.map(f => f.label.toLowerCase());
    fieldIdentifiers.sort((a, b) => b.length - a.length);
    const escapedIdentifiers = fieldIdentifiers.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const filterRegex = new RegExp(`(?:^|\\s)(${escapedIdentifiers.join("|")}):(?:"([^"]+)"|([^\\s"]+))`, "gi");

    let match;
    const activeFilters: Record<string, string[]> = {};
    let hasAdvancedFilters = false;

    let remainingSearch = searchTerm;
    while ((match = filterRegex.exec(searchTerm)) !== null) {
      hasAdvancedFilters = true;
      const key = match[1].toLowerCase();
      const value = (match[2] || match[3]).toLowerCase();
      if (!activeFilters[key]) activeFilters[key] = [];
      activeFilters[key].push(value);
      remainingSearch = remainingSearch.replace(match[0], "");
    }

    const cleanSearch = remainingSearch.trim().toLowerCase();

    if (hasAdvancedFilters) {
      const filterMatches = Object.entries(activeFilters).every(([key, values]) => {
        const field = fields.find(f => f.label.toLowerCase() === key);
        if (!field) return true;

        const itemValue = String((item as any)[field.key] || "").toLowerCase();

        if (field.type === "select" && field.options) {
          const option = field.options.find(o => o.value === (item as any)[field.key]);
          const optionLabel = option ? option.label.toLowerCase() : "";
          return (values as string[]).some(v => itemValue.includes(v) || optionLabel.includes(v));
        }

        return (values as string[]).some(v => itemValue.includes(v));
      });

      const matchesGeneral = !cleanSearch || fields.some(f => {
        if (f.type === "image") return false;
        const val = item[f.key];
        return String(val || "").toLowerCase().includes(cleanSearch);
      });

      return filterMatches && matchesGeneral;
    }

    return fields.some(f => {
      if (f.type === "image") return false;
      const val = item[f.key];
      if (f.type === "select" && f.options) {
        const option = f.options.find(o => o.value === val);
        if (option?.label.toLowerCase().includes(searchLower)) return true;
      }
      return String(val || "").toLowerCase().includes(searchLower);
    });
  });

  const getSuggestions = () => {
    const words = searchTerm.split(' ');
    const lastWord = words[words.length - 1];
    const searchLower = lastWord.toLowerCase();

    const keys = fields.map(f => f.label.toLowerCase() + ':');

    if (!lastWord.includes(':')) {
      return keys.filter(k => k.startsWith(searchLower));
    }

    // Suggest values for a key
    const [key, value] = lastWord.split(':');
    const valLower = value.toLowerCase();

    const field = fields.find(f => f.label.toLowerCase() === key || f.key.toLowerCase() === key);
    if (field) {
      if (field.type === 'select' && field.options) {
        return field.options
          .filter(o => o.label.toLowerCase().includes(valLower))
          .map(o => `${key}:"${o.label}"`);
      }

      // For other fields, suggest unique values from data
      return Array.from(new Set(data.map((item: any) => String(item[field.key] || ''))))
        .filter((v: string) => v && v.toLowerCase().includes(valLower))
        .map((v: string) => v.includes(' ') ? `${key}:"${v}"` : `${key}:${v}`);
    }

    return [];
  };

  return (
    <div className="app-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="app-title">{title}</h1>
          <p className="app-subtitle">Manage your {title.toLowerCase()} reference data.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="app-button-primary"
        >
          <Plus className="w-5 h-5" />
          Add {title}
        </button>
      </div>

      <div className="app-surface">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex-1 relative">
            <AutocompleteSearch
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={getSuggestions()}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto overscroll-contain">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                {tableFields.map(f => (
                  <th key={f.key} className="px-6 py-4 font-semibold">{f.label}</th>
                ))}
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={tableFields.length + 1} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={tableFields.length + 1} className="px-6 py-12 text-center text-gray-400">
                    No records found.
                  </td>
                </tr>
              ) : filteredData.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "hover:bg-gray-50 transition-colors group",
                    collectionName === 'categories' && "cursor-pointer"
                  )}
                  onClick={collectionName === 'categories' ? () => openItemDetails(item) : undefined}
                >
                  {tableFields.map(f => (
                    <td key={f.key} className="px-6 py-4 text-sm font-medium text-gray-700">
                      {f.type === 'image' ? (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                          {item[f.key] ? (
                            <img src={item[f.key]} alt={f.label} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold uppercase text-center px-1 leading-tight">No Photo</span>
                          )}
                        </div>
                      ) : f.type === 'select' ? (
                        getFieldDisplayValue(f, item)
                      ) : primaryClickableField === f.key ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openItemDetails(item);
                          }}
                          className="text-left font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
                        >
                          {getFieldDisplayValue(f, item)}
                        </button>
                      ) : (
                        getFieldDisplayValue(f, item)
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openItemDetails(item);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                        title="View Details"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingId(item.id);
                          setFormData(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "relative bg-white rounded-3xl shadow-2xl w-full overflow-hidden",
                collectionName === 'clients' ? "max-w-4xl" : "max-w-lg"
              )}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{title} Details</h3>
                <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {detailFields.map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{f.label}</label>
                      {f.type === 'image' ? (
                        <div className="w-24 h-24 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                          {viewingItem[f.key] ? (
                            <img src={viewingItem[f.key]} alt={f.label} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400 font-bold uppercase">No Photo</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-gray-800">
                          {getFieldDisplayValue(f, viewingItem) || 'N/A'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {getDetailsRoute(viewingItem) && !['clients', 'suppliers'].includes(collectionName) && (
                  <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Detailed Report</p>
                    <button
                      type="button"
                      onClick={() => navigate(getDetailsRoute(viewingItem)!)}
                      className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-gray-800 transition-all active:scale-95"
                    >
                      Open
                    </button>
                  </div>
                )}
                {collectionName === 'warehouses' && (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Manager Info</label>
                      {(() => {
                        const mgr = getWarehouseManagerSummary(viewingItem);
                        const isSystemManager = Boolean(viewingItem.manager_id);
                        const isManager = user && (user.email === mgr.email || user.uid === viewingItem.manager_id);
                        const isMissingInfo = mgr.phone === 'N/A' || mgr.email === 'N/A';

                        if (isEditingManagerInfo) return null;

                        if (isSystemManager) return null;

                        if (isManager) {
                          return (
                            <button
                              onClick={() => {
                                setManagerFormData({ phone: mgr.phone === 'N/A' ? '' : mgr.phone, email: mgr.email === 'N/A' ? '' : mgr.email });
                                setIsEditingManagerInfo(true);
                              }}
                              className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                            >
                              Edit Info
                            </button>
                          );
                        }

                        if (isMissingInfo) {
                          return (
                            <button
                              onClick={() => {
                                setManagerFormData({ phone: mgr.phone === 'N/A' ? '' : mgr.phone, email: mgr.email === 'N/A' ? '' : mgr.email });
                                setIsEditingManagerInfo(true);
                              }}
                              className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                            >
                              Add Information
                            </button>
                          );
                        }

                        return null;
                      })()}
                    </div>

                    {isEditingManagerInfo ? (
                      <form onSubmit={handleManagerInfoUpdate} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Phone Number"
                            value={managerFormData.phone}
                            onChange={(e) => setManagerFormData({ ...managerFormData, phone: e.target.value })}
                            className="bg-white border-gray-200 rounded-lg py-2 px-3 text-xs w-full focus:ring-1 focus:ring-black"
                          />
                          <input
                            type="email"
                            placeholder="Email Address"
                            value={managerFormData.email}
                            onChange={(e) => setManagerFormData({ ...managerFormData, email: e.target.value })}
                            className="bg-white border-gray-200 rounded-lg py-2 px-3 text-xs w-full focus:ring-1 focus:ring-black"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 bg-black text-white py-2 rounded-lg text-xs font-bold hover:bg-gray-800"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingManagerInfo(false)}
                            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-gray-800">{getWarehouseManagerSummary(viewingItem).name}</p>
                        <p className="text-xs text-gray-500 mt-1">{getWarehouseManagerSummary(viewingItem).sourceMessage}</p>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Phone</label>
                            <p className="text-sm font-bold text-gray-800">{getWarehouseManagerSummary(viewingItem).phone}</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Email</label>
                            <p className="text-sm font-bold text-gray-800">{getWarehouseManagerSummary(viewingItem).email}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {collectionName === 'clients' && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transfer History</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Open the full client page to review all transfers and export them.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(getDetailsRoute(viewingItem)!)}
                        className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                      >
                        Open Transfers Page
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Payments</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Open the payment page to track what the client paid and what is still due.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${viewingItem.id}/payments`)}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Open Payments Page
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                        Client Transfers
                      </label>
                      {clientActivityForViewingItem.length > 0 ? (
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 font-bold">Invoice</th>
                                <th className="px-4 py-3 font-bold">Date</th>
                                <th className="px-4 py-3 font-bold">Warehouse</th>
                                <th className="px-4 py-3 font-bold">Type</th>
                                <th className="px-4 py-3 font-bold text-right">Qty</th>
                                <th className="px-4 py-3 font-bold text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {clientActivityForViewingItem.map((invoice: any) => (
                                <tr key={invoice.id}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">
                                    <div>{invoice.invoice_number || 'N/A'}</div>
                                    <div className="text-xs text-gray-400">{invoice.status || 'N/A'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">
                                    {invoice.created_at ? new Date(invoice.created_at).toLocaleString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{invoice.warehouseName || 'N/A'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${invoice.transferTypeLabel === 'sell'
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'bg-emerald-50 text-emerald-700'
                                      }`}>
                                      {invoice.transferTypeLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                    {sanitizeQuantity(invoice.totalQuantity)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-800">
                                    {typeof invoice.total_amount === 'number'
                                      ? `$${sanitizeMoney(invoice.total_amount).toLocaleString()}`
                                      : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No transfers recorded for this client yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {collectionName === 'suppliers' && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Supplier Activity</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Open the full supplier page to review movements and export them.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(getDetailsRoute(viewingItem)!)}
                        className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                      >
                        Open Transfers Page
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                        Recent Supplier Movements
                      </label>
                      {supplierActivityForViewingItem.length > 0 ? (
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 font-bold">Date</th>
                                <th className="px-4 py-3 font-bold">Warehouse</th>
                                <th className="px-4 py-3 font-bold">Type</th>
                                <th className="px-4 py-3 font-bold">Item</th>
                                <th className="px-4 py-3 font-bold text-right">Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {supplierActivityForViewingItem.map((movement: any) => (
                                <tr key={movement.id}>
                                  <td className="px-4 py-3 text-gray-500">
                                    {movement.timestamp ? new Date(movement.timestamp).toLocaleString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{movement.warehouseName}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                      {movement.movement_type || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">{movement.variantLabel}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{movement.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No supplier activity recorded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {(collectionName === 'brands' || collectionName === 'categories') && (
                  <div className="space-y-4 pt-2">
                    {collectionName === 'categories' && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Child Categories</label>
                        {childCategoriesForViewingItem.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {childCategoriesForViewingItem.map((category) => (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setViewingItem(category)}
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {category.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No child categories.</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                        Related Products
                      </label>
                      {relatedProductsForViewingItem.length > 0 ? (
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 font-bold">Name</th>
                                <th className="px-4 py-3 font-bold">SKU</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {relatedProductsForViewingItem.map((product) => (
                                <tr key={product.id}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">
                                    <button
                                      type="button"
                                      onClick={() => openRelatedProductDetails(product)}
                                      className="hover:text-indigo-600 hover:underline"
                                    >
                                      {product.name}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">{product.sku || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No products linked to this {title.toLowerCase()}.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Created At</label>
                    <p className="text-xs text-gray-500">
                      {viewingItem.created_at ? new Date(viewingItem.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Last Modified</label>
                    <p className="text-xs text-gray-500">
                      {viewingItem.last_modified ? new Date(viewingItem.last_modified).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setViewingItem(null)}
                    className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} {title}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formFields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{f.label}</label>
                    {f.type === 'select' ? (
                      <select
                        required={f.required}
                        value={formData[f.key] || ''}
                        disabled={f.readOnly}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        className={cn(
                          "w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-black transition-all",
                          f.readOnly && "cursor-not-allowed bg-gray-100 text-gray-500"
                        )}
                      >
                        <option value="">Select {f.label}</option>
                        {f.options?.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'image' ? (
                      <input
                        type="text"
                        required={f.required}
                        readOnly={f.readOnly}
                        placeholder="https://example.com/photo.png"
                        value={formData[f.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        className={cn(
                          "w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-black transition-all",
                          f.readOnly && "cursor-not-allowed bg-gray-100 text-gray-500"
                        )}
                      />
                    ) : (
                      <input
                        type={f.type}
                        required={f.required}
                        readOnly={f.readOnly}
                        value={formData[f.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className={cn(
                          "w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-black transition-all",
                          f.readOnly && "cursor-not-allowed bg-gray-100 text-gray-500"
                        )}
                      />
                    )}
                  </div>
                ))}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    {editingId ? 'Save Changes' : `Add ${title}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRelatedProduct && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRelatedProduct(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Package className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedRelatedProduct.name}</h3>
                    <p className="text-gray-500 font-mono text-sm">SKU: {selectedRelatedProduct.sku}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRelatedProduct(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Brand & Category</label>
                  <p className="text-sm font-bold text-gray-800">{selectedRelatedProduct.brand_name}</p>
                  <p className="text-xs text-gray-500">{selectedRelatedProduct.category_name}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Variants</label>
                  <p className="text-3xl font-black text-gray-900">{selectedRelatedProduct.variants?.length || 0}</p>
                  <p className="text-xs text-gray-500">Available options</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Supplier Info</label>
                  <p className="text-sm font-bold text-gray-800">{selectedRelatedProduct.supplier_name}</p>
                  <p className="text-xs text-gray-500">Primary Provider</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Stock</label>
                  <p className="text-3xl font-black text-gray-900">
                    {selectedRelatedProduct.distribution?.reduce((acc: number, b: any) => acc + b.quantity, 0) || 0}
                  </p>
                  <p className="text-xs text-gray-500">Across {selectedRelatedProduct.distribution?.length || 0} locations</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Variants</h4>
                <div className="space-y-2 relative">
                  {!handleVariantClick && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                      <span className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">View details from Dashboard</span>
                    </div>
                  )}
                  <div className={cn("space-y-2 focus-within:outline-none", !handleVariantClick && "opacity-60 pointer-events-none")}>
                    {selectedRelatedProduct.variants?.map((variant: any) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          if (handleVariantClick) {
                            setSelectedRelatedProduct(null);
                            handleVariantClick(variant.id);
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-800">{variant.variant_code}</p>
                          <p className="text-xs text-gray-500">Barcode: {variant.barcode || 'N/A'}</p>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{variant.stock_total} units</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Warehouse Distribution</h4>
                <div className="space-y-2">
                  {selectedRelatedProduct.distribution?.map((b: any) => (
                    <div key={b.warehouse_id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-white">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">{getWarehouseName(b.warehouse_id)}</span>
                      </div>
                      <span className="text-sm font-bold">{b.quantity} units</span>
                    </div>
                  ))}
                  {(!selectedRelatedProduct.distribution || selectedRelatedProduct.distribution.length === 0) && (
                    <p className="text-xs font-medium text-gray-500 italic p-3 text-center border border-gray-100 border-dashed rounded-xl">No stock available</p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setSelectedRelatedProduct(null)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
