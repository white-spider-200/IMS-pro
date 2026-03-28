import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Search, Edit2, Trash2, X, Filter, Package, Warehouse as WarehouseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '../lib/utils';
import AutocompleteSearch from './AutocompleteSearch';
import { useOutletContext } from 'react-router-dom';

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
  const { balances = [], variants = [], warehouses = [], handleVariantClick } = outletContext;

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

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy(sortField, 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [collectionName, sortField]);

  useEffect(() => {
    if (!shouldLoadRelatedProducts) {
      setRelatedProducts([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      setRelatedProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, [shouldLoadRelatedProducts]);

  useEffect(() => {
    if (!shouldLoadRelatedProducts) {
      setProductLookups({ brands: [], categories: [], suppliers: [] });
      return;
    }

    const unsubBrands = onSnapshot(collection(db, 'brands'), (snapshot) => {
      setProductLookups((current) => ({ ...current, brands: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brands');
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setProductLookups((current) => ({ ...current, categories: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setProductLookups((current) => ({ ...current, suppliers: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    return () => {
      unsubBrands();
      unsubCategories();
      unsubSuppliers();
    };
  }, [shouldLoadRelatedProducts]);

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

  const childCategoriesForViewingItem = useMemo(() => {
    if (!viewingItem || collectionName !== 'categories') return [];
    return data.filter((category) => category.parent_category_id === viewingItem.id);
  }, [collectionName, data, viewingItem]);

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

  const getWarehouseName = (id: string) => {
    return warehouses.find((w: any) => w.id === id)?.name || id;
  };

  const openItemDetails = (item: any) => {
    if (onView) {
      onView(item);
      return;
    }
    setViewingItem(item);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(collectionName === 'suppliers' ? { supplier_code: createSupplierCode(data) } : {});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
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

    const basePayload = {
      ...formData,
      ...(collectionName === 'suppliers' && !formData.supplier_code ? { supplier_code: createSupplierCode(data) } : {}),
      last_modified: new Date().toISOString()
    };

    try {
      if (editingId) {
        try {
          await updateDoc(doc(db, collectionName, editingId), basePayload);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${editingId}`);
        }
        toast.success(`${title} updated successfully`);
      } else {
        try {
          await addDoc(collection(db, collectionName), {
            ...basePayload,
            ...(hideStatus ? {} : { status: formData.status || 'active' }),
            created_at: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, collectionName);
        }
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
    try {
      if (hardDelete) {
        await deleteDoc(doc(db, collectionName, id));
        toast.success(`${title} deleted`);
        return;
      }

      await updateDoc(doc(db, collectionName, id), { status: 'inactive' });
      toast.success(`${title} deactivated`);
    } catch (error) {
      handleFirestoreError(error, hardDelete ? OperationType.DELETE : OperationType.UPDATE, `${collectionName}/${id}`);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-gray-500 text-sm">Manage your {title.toLowerCase()} reference data.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-black text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add {title}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
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
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
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

                {collectionName === 'warehouses' && (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Manager Info</label>
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
