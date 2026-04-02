import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Boxes, Plus, ArrowRightLeft, Search, Filter, Warehouse as WarehouseIcon, Package, AlertTriangle, History as HistoryIcon, List, X, Users, Info, DollarSign, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { InventoryService } from '../services/inventoryService';
import { seedInitialData, seedBigData, clearAllData } from '../lib/seed';
import AutocompleteSearch from '../components/AutocompleteSearch';
import { isFirestoreSyncPaused, pauseFirestoreSync, resumeFirestoreSync, subscribeFirestoreSyncPause } from '../lib/syncPause';
import { clearDemoDatabase, receiveDemoStock, resetDemoDatabase, saveDemoCollectionItem, transferDemoStock, issueDemoStock } from '../demo/demoDatabase';

import { useOutletContext } from 'react-router-dom';

export default function InventoryDashboard() {
  const context = useOutletContext<any>();
  const isDemoMode = context?.isDemoMode;

  const [balances, setBalances] = useState<any[]>(context?.balances || []);
  const [variants, setVariants] = useState<any[]>(context?.variants || []);
  const [products, setProducts] = useState<any[]>(context?.products || []);
  const [warehouses, setWarehouses] = useState<any[]>(context?.warehouses || []);
  const [movements, setMovements] = useState<any[]>(context?.movements || []);
  const [revenueInvoices, setRevenueInvoices] = useState<any[]>(context?.revenueInvoices || []);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>(context?.purchaseInvoices || []);
  const [returnInvoices, setReturnInvoices] = useState<any[]>(context?.returnInvoices || []);
  const [brands, setBrands] = useState<any[]>(context?.brands || []);
  const [categories, setCategories] = useState<any[]>(context?.categories || []);
  const [suppliers, setSuppliers] = useState<any[]>(context?.suppliers || []);
  const [clients, setClients] = useState<any[]>(context?.clients || []);
  const [users, setUsers] = useState<any[]>(context?.users || []);
  const [loading, setLoading] = useState(!context);
  const user = context?.user;

  const [isEditingManagerInfo, setIsEditingManagerInfo] = useState(false);
  const [managerFormData, setManagerFormData] = useState({ phone: '', email: '' });

  const handleManagerInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    if (selectedWarehouse.manager_id) {
      toast.info('This warehouse uses a system manager. Update contact details from the profile page instead.');
      setIsEditingManagerInfo(false);
      return;
    }

    try {
      const updates = {
        manual_manager_phone: managerFormData.phone,
        manual_manager_email: managerFormData.email,
        last_modified: new Date().toISOString()
      };

      if (isDemoMode) {
        saveDemoCollectionItem('warehouses', {
          ...selectedWarehouse,
          ...updates,
        });
      } else {
        const warehouseRef = doc(db, 'warehouses', selectedWarehouse.id);
        await updateDoc(warehouseRef, updates);
      }

      setSelectedWarehouse({
        ...selectedWarehouse,
        ...updates,
        manager_phone: updates.manual_manager_phone,
        manager_email: updates.manual_manager_email
      });

      toast.success('Manager info updated successfully');
      setIsEditingManagerInfo(false);
    } catch (error) {
      console.error('Failed to update manager info:', error);
      toast.error('Failed to update manager info');
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [transferInvoices, setTransferInvoices] = useState<any[]>(context?.transferInvoices || []);
  const [isTransferInvoiceModalOpen, setIsTransferInvoiceModalOpen] = useState(false);
  const [selectedTransferInvoice, setSelectedTransferInvoice] = useState<any>(null);
  const [isSyncPaused, setIsSyncPaused] = useState(isFirestoreSyncPaused());

  // Sync state with context updates (especially for Demo Mode initial load)
  useEffect(() => {
    if (context) {
      if (context.balances) setBalances(context.balances);
      if (context.variants) setVariants(context.variants);
      if (context.products) setProducts(context.products);
      if (context.warehouses) {
        setWarehouses(context.warehouses);
        if (context.warehouses.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(context.warehouses[0].id);
        }
      }
      if (context.movements) setMovements(context.movements);
      if (context.revenueInvoices) setRevenueInvoices(context.revenueInvoices);
      if (context.purchaseInvoices) setPurchaseInvoices(context.purchaseInvoices);
      if (context.returnInvoices) setReturnInvoices(context.returnInvoices);
      if (context.brands) setBrands(context.brands);
      if (context.categories) setCategories(context.categories);
      if (context.suppliers) setSuppliers(context.suppliers);
      if (context.clients) setClients(context.clients);
      if (context.users) setUsers(context.users);
      if (context.transferInvoices) setTransferInvoices(context.transferInvoices);
      setLoading(false);
    }
  }, [context]);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    return typeof error === 'string' ? error : 'Unknown error';
  };

  useEffect(() => subscribeFirestoreSyncPause(() => {
    setIsSyncPaused(isFirestoreSyncPaused());
  }), []);

  const runWithPausedSync = async (operation: () => Promise<void>) => {
    pauseFirestoreSync();
    try {
      await operation();
    } finally {
      window.setTimeout(() => resumeFirestoreSync(), 250);
    }
  };

  const toDateObject = (value: any) => {
    if (!value) return null;
    if (value?.toDate) {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      const [datePart, timePart] = value.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toTimestampMs = (value: any, fallback = 0) => {
    const date = toDateObject(value);
    return date ? date.getTime() : fallback;
  };

  const formatDateTime = (dateStr: any) => {
    const date = toDateObject(dateStr);
    return date ? date.toLocaleString() : 'N/A';
  };

  const handleSeed = async () => {
    try {
      if (isDemoMode) {
        resetDemoDatabase();
        toast.success('Demo data reset successfully');
        return;
      }
      await runWithPausedSync(() => seedInitialData());
      toast.success('Initial data seeded successfully');
    } catch (error) { toast.error(`Seeding failed: ${getErrorMessage(error)}`); }
  };

  const handleBigSeed = async () => {
    const loadingToast = toast.loading('Seeding large data batch...');
    try {
      if (isDemoMode) {
        resetDemoDatabase();
        toast.dismiss(loadingToast);
        toast.success('Demo database reset to full local dataset');
        return;
      }
      await runWithPausedSync(() => seedBigData());
      toast.dismiss(loadingToast);
      toast.success('Large data batch seeded successfully');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(`Big seeding failed: ${getErrorMessage(error)}`);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Clear all inventory, master data, orders, and seeded records?')) return;
    const loadingToast = toast.loading('Clearing all data...');
    try {
      if (isDemoMode) {
        clearDemoDatabase();
        toast.dismiss(loadingToast);
        toast.success('Demo database cleared');
        return;
      }
      await runWithPausedSync(() => clearAllData());
      toast.dismiss(loadingToast);
      toast.success('All data cleared successfully');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(`Failed to clear data: ${getErrorMessage(error)}`);
    }
  };

  useEffect(() => {
    if (isDemoMode || isSyncPaused) return;

    const handleError = (error: any) => {
      console.error('Firestore snapshot error:', error);
      toast.error('Failed to sync inventory data');
      setLoading(false);
    };

    const unsubBalances = onSnapshot(collection(db, 'inventory_balances'), (s) => {
      setBalances(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, handleError);

    const unsubVariants = onSnapshot(collection(db, 'product_variants'), (s) => setVariants(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubProducts = onSnapshot(collection(db, 'products'), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (s) => {
      const wData = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setWarehouses(wData);
      setSelectedWarehouseId(current => (wData.length > 0 && !current) ? wData[0].id : current);
    }, handleError);
    const unsubMovements = onSnapshot(collection(db, 'stock_movements'), (s) => setMovements(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubInvoices = onSnapshot(collection(db, 'revenue_invoices'), (s) => setRevenueInvoices(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubReturnInvoices = onSnapshot(collection(db, 'return_invoices'), (s) => setReturnInvoices(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubBrands = onSnapshot(collection(db, 'brands'), (s) => setBrands(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubCategories = onSnapshot(collection(db, 'categories'), (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (s) => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);
    const unsubTransferInvoices = onSnapshot(collection(db, 'transfer_invoices'), (s) => setTransferInvoices(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError);

    return () => {
      unsubBalances(); unsubVariants(); unsubProducts(); unsubWarehouses(); unsubMovements(); unsubInvoices();
      unsubBrands(); unsubCategories(); unsubSuppliers(); unsubClients(); unsubUsers(); unsubTransferInvoices(); unsubReturnInvoices();
    };
  }, [isDemoMode, isSyncPaused]);

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { variant_id, warehouse_id, quantity, batch_id } = formData;
      if (isDemoMode) {
        receiveDemoStock(variant_id, warehouse_id, Number(quantity), batch_id || 'manual');
        toast.success('Stock received successfully');
        setIsReceiveModalOpen(false);
        setFormData({});
        return;
      }
      await InventoryService.receiveStock(variant_id, warehouse_id, Number(quantity), batch_id || 'manual', `rec_${Date.now()}`);
      toast.success('Stock received successfully'); setIsReceiveModalOpen(false); setFormData({});
    } catch (error: any) { toast.error(error.message || 'Operation failed'); }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { variant_id, warehouse_id, quantity, client_id, unit_price } = formData;
      const customer_name = clients.find(c => c.id === client_id)?.name || 'Unknown Client';
      if (isDemoMode) {
        issueDemoStock(variant_id, warehouse_id, Number(quantity), customer_name, client_id, Number(unit_price || 0));
        toast.success('Stock delivered successfully');
        setIsIssueModalOpen(false);
        setFormData({});
        return;
      }
      await InventoryService.issueStock(variant_id, warehouse_id, Number(quantity), customer_name, `iss_${Date.now()}`, { unitPrice: Number(unit_price || 0), clientId: client_id });
      toast.success('Stock delivered successfully'); setIsIssueModalOpen(false); setFormData({});
    } catch (error: any) { toast.error(error.message || 'Operation failed'); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { variant_id, from_warehouse_id, to_warehouse_id, quantity } = formData;
      if (from_warehouse_id === to_warehouse_id) throw new Error('Source and destination must be different');
      if (isDemoMode) {
        transferDemoStock(variant_id, from_warehouse_id, to_warehouse_id, Number(quantity));
        toast.success('Stock transferred successfully');
        setIsTransferModalOpen(false);
        setFormData({});
        return;
      }
      await InventoryService.transferStock(variant_id, from_warehouse_id, to_warehouse_id, Number(quantity), `tr_${Date.now()}`);
      toast.success('Stock transferred successfully'); setIsTransferModalOpen(false); setFormData({});
    } catch (error: any) { toast.error(error.message || 'Operation failed'); }
  };

  const getVariantName = (id: string) => {
    const v = variants.find(v => v.id === id);
    return v ? `${v.variant_code} (${v.barcode})` : id;
  };

  const getProductName = (variantId: string) => {
    const v = variants.find(v => v.id === variantId);
    if (!v) return 'Unknown Variant';
    const p = products.find(p => p.id === v.product_id);
    return p ? p.name : 'Unknown Product';
  };

  const getStatus = (variantId: string, warehouseId: string, quantity: number) => {
    const inTransit = movements.some(m =>
      m.variant_id === variantId &&
      m.warehouse_id === warehouseId &&
      m.status === 'in_transit'
    );
    if (inTransit) return { label: 'On the Way', color: 'text-blue-600 bg-blue-50' };
    if (quantity <= 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
    if (quantity < 10) return { label: 'Low Stock', color: 'text-orange-600 bg-orange-50' };
    return { label: 'In Stock', color: 'text-green-600 bg-green-50' };
  };

  const getWarehouseName = (id: string) => {
    return warehouses.find(w => w.id === id)?.name || id;
  };

  const handleStatusClick = (variantId: string, warehouseId: string) => {
    // Find the most recent invoice that contains this variant and matches the warehouse
    const invoice = revenueInvoices
      .filter(inv => inv.warehouse_id === warehouseId && inv.items.some((item: any) => item.variant_id === variantId))
      .sort((a, b) => toTimestampMs(b.created_at) - toTimestampMs(a.created_at))[0];

    if (invoice) {
      setSelectedInvoice(invoice);
      setIsInvoiceModalOpen(true);
    } else {
      toast.info('No revenue invoice found for this item in this warehouse.');
    }
  };

  const handleIdClick = (item: any) => {
    // Find the most recent movement for this balance to show "Transfer Info"
    const lastMovement = movements
      .filter(m => m.variant_id === item.variant_id && m.warehouse_id === item.warehouse_id)
      .sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp))[0];

    if (lastMovement) {
      setSelectedMovement(lastMovement);
      setIsMovementModalOpen(true);
    } else {
      toast.info('No movement history found for this item.');
    }
  };

  const handleItemDetailsClick = (item: any) => {
    const history = movements
      .filter(m => m.variant_id === item.variant_id && m.warehouse_id === item.warehouse_id)
      .sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp));

    setSelectedHistory({
      balance: item,
      history: history
    });
    setIsHistoryModalOpen(true);
  };

  const handleMovementClick = (movement: any) => {
    setSelectedMovement(movement);
    setIsMovementModalOpen(true);
  };

  const handleVariantClick = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;
    const product = products.find(p => p.id === variant.product_id);
    const brand = brands.find(b => b.id === product?.brand_id);
    const category = categories.find(c => c.id === product?.category_id);
    const supplier = suppliers.find(s => s.id === product?.supplier_id);

    const attributes: any = {};
    if (variant.color) attributes.color = variant.color;
    if (variant.size) attributes.size = variant.size;
    if (variant.reorder_threshold) attributes['Reorder Point'] = variant.reorder_threshold;

    setSelectedVariant({
      ...variant,
      attributes,
      product_name: product?.name,
      sku: product?.sku,
      category_id: product?.category_id,
      supplier_id: supplier?.id,
      brand_name: brand?.name,
      category_name: category?.name,
      supplier_name: supplier?.name,
      distribution: balances.filter(b => b.variant_id === variantId)
    });
    setIsVariantModalOpen(true);
  };

  const handleProductClick = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;
    const product = products.find(p => p.id === variant.product_id);
    if (!product) return;
    const brand = brands.find(b => b.id === product?.brand_id);
    const category = categories.find(c => c.id === product?.category_id);
    const supplier = suppliers.find(s => s.id === product?.supplier_id);
    const productVariants = variants
      .filter(v => v.product_id === product.id)
      .map((productVariant) => ({
        ...productVariant,
        stock_total: balances
          .filter((balance) => balance.variant_id === productVariant.id)
          .reduce((acc: number, balance: any) => acc + balance.available_quantity, 0)
      }));

    const distributionByWarehouse = balances
      .filter((balance) => productVariants.some((productVariant) => productVariant.id === balance.variant_id))
      .reduce((acc: Record<string, { warehouse_id: string; quantity: number }>, balance: any) => {
        if (!acc[balance.warehouse_id]) {
          acc[balance.warehouse_id] = { warehouse_id: balance.warehouse_id, quantity: 0 };
        }
        acc[balance.warehouse_id].quantity += balance.available_quantity;
        return acc;
      }, {});

    setSelectedProduct({
      ...product,
      brand_name: brand?.name || 'Unknown Brand',
      brand_logo_url: brand?.logo_url || '',
      category_name: category?.name || 'Unknown Category',
      supplier_id: supplier?.id,
      supplier_name: supplier?.name || 'Unknown Supplier',
      variants: productVariants,
      distribution: Object.values(distributionByWarehouse)
    });
    setIsProductModalOpen(true);
  };

  const handleWarehouseClick = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (!warehouse) return;

    const warehouseBalances = balances.filter(b => b.warehouse_id === warehouseId);
    const warehouseMovements = movements.filter(m => m.warehouse_id === warehouseId);
    const manager = users.find(u => u.id === warehouse.manager_id);

    setSelectedWarehouse({
      ...warehouse,
      manager_name: manager?.displayName || warehouse.manual_manager_name || 'No Manager Assigned',
      manager_email: manager?.email || warehouse.manual_manager_email || '',
      manager_phone: manager?.phone || warehouse.manual_manager_phone || '',
      is_system_manager: !!manager,
      balances: warehouseBalances,
      movements: warehouseMovements
    });
    setIsWarehouseModalOpen(true);
  };

  const handleSupplierClick = (supplierId?: string) => {
    if (!supplierId) return;
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    setSelectedSupplier(supplier);
    setIsSupplierModalOpen(true);
  };

  const handleCategoryClick = (categoryId?: string) => {
    if (!categoryId) return;
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) return;

    const childCategories = categories.filter((entry) => entry.parent_category_id === categoryId);
    const relatedProducts = products
      .filter((product) => product.category_id === categoryId)
      .map((product) => ({
        ...product,
        variants: variants.filter((variant) => variant.product_id === product.id),
      }));

    setSelectedCategory({
      ...category,
      childCategories,
      relatedProducts,
    });
    setIsCategoryModalOpen(true);
  };

  const getLatestMovementForBalance = (variantId: string, warehouseId: string) => {
    return movements
      .filter((movement) => movement.variant_id === variantId && movement.warehouse_id === warehouseId)
      .sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp))[0];
  };

  const getMovementDisplayLabel = (movement: any) => {
    const type = String(movement?.movement_type || '').toLowerCase();
    if (type === 'issue') return 'sell';
    if (type === 'receipt') return 'buy';
    if (type === 'return') {
      return movement?.return_scope === 'purchase' ? 'buy return' : 'sale return';
    }
    return type.replace('_', ' ') || 'unknown';
  };

  const isOutgoingMovement = (movement: any) => {
    const type = String(movement?.movement_type || '').toLowerCase();
    if (['issue', 'transfer_out'].includes(type)) return true;
    if (type === 'return') return movement?.return_direction === 'out';
    return false;
  };

  const getMovementTypeMeta = (movementType?: string) => {
    const normalized = movementType || 'unknown';
    if (normalized === 'issue') {
      return {
        label: 'sell',
        className: 'bg-red-50 text-red-600',
      };
    }

    if (normalized === 'receipt') {
      return {
        label: 'buy',
        className: 'bg-green-50 text-green-600',
      };
    }

    if (normalized === 'return') {
      return {
        label: 'return',
        className: 'bg-amber-50 text-amber-700',
      };
    }

    if (normalized === 'transfer_out') {
      return {
        label: 'transfer out',
        className: 'bg-red-50 text-red-600',
      };
    }

    if (normalized === 'unknown') {
      return {
        label: 'unknown',
        className: 'bg-gray-100 text-gray-500',
      };
    }

    return {
      label: normalized.replace('_', ' '),
      className: 'bg-green-50 text-green-600',
    };
  };

  const filteredBalances = balances.filter(b => {
    // 1. Date Filter (Always applies)
    const itemTime = toTimestampMs(b.last_modified, -Infinity);
    const from = filterDateFrom ? toTimestampMs(filterDateFrom) : 0;
    const to = filterDateTo ? toTimestampMs(filterDateTo) : Infinity;
    const matchesDate = itemTime >= from && itemTime <= to;
    if (!matchesDate) return false;

    // 2. Search Filter
    if (!searchTerm) return true;

    const variant = variants.find(v => v.id === b.variant_id);
    const product = variant ? products.find(p => p.id === variant.product_id) : null;
    const warehouse = warehouses.find(w => w.id === b.warehouse_id);
    const supplier = product ? suppliers.find(s => s.id === product.supplier_id) : null;
    const category = product ? categories.find(c => c.id === product.category_id) : null;
    const latestMovement = getLatestMovementForBalance(b.variant_id, b.warehouse_id);
    const movementType = String(latestMovement?.movement_type || '').toLowerCase();

    const searchLower = searchTerm.toLowerCase();

    // Parse advanced filters: key:value or key:"value"
    const filterRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
    let match;
    const activeFilters: Record<string, string[]> = {};
    let hasAdvancedFilters = false;

    // Extract all filters
    let remainingSearch = searchTerm;
    while ((match = filterRegex.exec(searchTerm)) !== null) {
      hasAdvancedFilters = true;
      const key = match[1].toLowerCase();
      const value = (match[2] || match[3]).toLowerCase();
      if (!activeFilters[key]) activeFilters[key] = [];
      activeFilters[key].push(value);
      remainingSearch = remainingSearch.replace(match[0], '');
    }

    const cleanSearch = remainingSearch.trim().toLowerCase();

    if (hasAdvancedFilters) {
      // Apply advanced filters (AND between different keys, OR between same keys)
      const matchesWarehouse = !activeFilters.warehouse || (activeFilters.warehouse as string[]).some(v => warehouse?.name.toLowerCase().includes(v));
      const matchesProduct = !activeFilters.product || (activeFilters.product as string[]).some(v => product?.name.toLowerCase().includes(v));
      const matchesSku = !activeFilters.sku || (activeFilters.sku as string[]).some(v => product?.sku.toLowerCase().includes(v));
      const matchesVariant = !activeFilters.variant || (activeFilters.variant as string[]).some(v => variant?.variant_code.toLowerCase().includes(v));
      const matchesBarcode = !activeFilters.barcode || (activeFilters.barcode as string[]).some(v => variant?.barcode.toLowerCase().includes(v));
      const matchesSupplier = !activeFilters.supplier || (activeFilters.supplier as string[]).some(v => supplier?.name.toLowerCase().includes(v));
      const matchesCategory = !activeFilters.category || (activeFilters.category as string[]).some(v => category?.name.toLowerCase().includes(v));
      const matchesType = !activeFilters.type || (activeFilters.type as string[]).some(v => movementType.includes(v));

      // If there's remaining text, it must match something too
      const matchesGeneral = !cleanSearch || (
        variant?.variant_code.toLowerCase().includes(cleanSearch) ||
        variant?.barcode.toLowerCase().includes(cleanSearch) ||
        product?.name.toLowerCase().includes(cleanSearch) ||
        product?.sku.toLowerCase().includes(cleanSearch) ||
        warehouse?.name.toLowerCase().includes(cleanSearch) ||
        supplier?.name.toLowerCase().includes(cleanSearch)
      );

      return matchesWarehouse && matchesProduct && matchesSku && matchesVariant && matchesBarcode && matchesSupplier && matchesCategory && matchesType && matchesGeneral;
    }

    // Default simple search
    return (
      variant?.variant_code.toLowerCase().includes(searchLower) ||
      variant?.barcode.toLowerCase().includes(searchLower) ||
      product?.name.toLowerCase().includes(searchLower) ||
      product?.sku.toLowerCase().includes(searchLower) ||
      warehouse?.name.toLowerCase().includes(searchLower) ||
      supplier?.name.toLowerCase().includes(searchLower) ||
      category?.name.toLowerCase().includes(searchLower) ||
      movementType.includes(searchLower)
    );
  });

  // Calculate filtered counts for the dashboard cards
  const totalStockUnits = filteredBalances.reduce((acc, b) => acc + (Number(b.available_quantity) || 0), 0);

  const getVariantAverageBuyCost = (variantId: string) => {
    const totals = purchaseInvoices.reduce(
      (accumulator, invoice) => {
        if (!invoice || invoice.status === 'cancelled' || invoice.product_variant_id !== variantId) {
          return accumulator;
        }

        const quantity = Number(invoice.quantity_purchased ?? invoice.requested_quantity ?? 0);
        const unitCost = Number(invoice.unit_cost ?? 0);

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return accumulator;
        }

        return {
          quantity: accumulator.quantity + quantity,
          cost: accumulator.cost + (quantity * unitCost),
        };
      },
      { quantity: 0, cost: 0 }
    );

    return totals.quantity > 0 ? totals.cost / totals.quantity : 0;
  };

  const totalStockValue = filteredBalances.reduce((acc, b) => {
    const averageBuyCost = getVariantAverageBuyCost(b.variant_id);
    return acc + (Number(b.available_quantity) || 0) * averageBuyCost;
  }, 0);

  const filteredWarehousesCount = new Set(filteredBalances.map(b => b.warehouse_id).filter(Boolean)).size;

  const filteredSuppliersCount = new Set(
    filteredBalances.map(b => {
      const variant = variants.find(v => v.id === b.variant_id);
      const product = products.find(p => p.id === variant?.product_id);
      return product?.supplier_id;
    }).filter(Boolean)
  ).size;

  const filteredMovements = movements.filter(m => {
    // 1. Date Filter
    const timestamp = toTimestampMs(m.timestamp, -Infinity);
    const from = filterDateFrom ? toTimestampMs(filterDateFrom) : 0;
    const to = filterDateTo ? toTimestampMs(filterDateTo) : Infinity;
    const matchesDate = timestamp >= from && timestamp <= to;
    if (!matchesDate) return false;

    // 2. Search Filter
    if (!searchTerm) return true;

    const variant = variants.find(v => v.id === m.variant_id);
    const product = variant ? products.find(p => p.id === variant.product_id) : null;
    const warehouse = warehouses.find(w => w.id === m.warehouse_id);

    const searchLower = searchTerm.toLowerCase();
    const filterRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
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
      remainingSearch = remainingSearch.replace(match[0], '');
    }

    const cleanSearch = remainingSearch.trim().toLowerCase();

    if (hasAdvancedFilters) {
      const matchesWarehouse = !activeFilters.warehouse || (activeFilters.warehouse as string[]).some(v => warehouse?.name.toLowerCase().includes(v));
      const matchesProduct = !activeFilters.product || (activeFilters.product as string[]).some(v => product?.name.toLowerCase().includes(v));
      const matchesSku = !activeFilters.sku || (activeFilters.sku as string[]).some(v => product?.sku.toLowerCase().includes(v));
      const matchesVariant = !activeFilters.variant || (activeFilters.variant as string[]).some(v => variant?.variant_code.toLowerCase().includes(v));
      const matchesBarcode = !activeFilters.barcode || (activeFilters.barcode as string[]).some(v => variant?.barcode.toLowerCase().includes(v));

      const matchesGeneral = !cleanSearch || (
        variant?.variant_code.toLowerCase().includes(cleanSearch) ||
        variant?.barcode.toLowerCase().includes(cleanSearch) ||
        product?.name.toLowerCase().includes(cleanSearch) ||
        product?.sku.toLowerCase().includes(cleanSearch) ||
        warehouse?.name.toLowerCase().includes(cleanSearch)
      );

      return matchesWarehouse && matchesProduct && matchesSku && matchesVariant && matchesBarcode && matchesGeneral;
    }

    return (
      variant?.variant_code.toLowerCase().includes(searchLower) ||
      variant?.barcode.toLowerCase().includes(searchLower) ||
      product?.name.toLowerCase().includes(searchLower) ||
      product?.sku.toLowerCase().includes(searchLower) ||
      warehouse?.name.toLowerCase().includes(searchLower)
    );
  });

  const filteredTransferRows = filteredMovements
    .filter((movement) => ['issue', 'receipt', 'return'].includes(String(movement.movement_type || '').toLowerCase()))
    .sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp));

  const getSuggestions = () => {
    const words = searchTerm.split(' ');
    const lastWord = words[words.length - 1];
    const searchLower = lastWord.toLowerCase();
    const filterRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
    const activeFilters: Record<string, string[]> = {};
    let match;

    while ((match = filterRegex.exec(searchTerm)) !== null) {
      const key = match[1].toLowerCase();
      const value = (match[2] || match[3]).toLowerCase();
      if (!activeFilters[key]) activeFilters[key] = [];
      activeFilters[key].push(value);
    }

    const keys = ['warehouse:', 'product:', 'sku:', 'variant:', 'barcode:', 'supplier:', 'category:', 'type:'];

    // If typing a key
    if (!lastWord.includes(':')) {
      return keys.filter(k => k.startsWith(searchLower));
    }

    // If typing a value for a key
    const [key, value] = lastWord.split(':');
    const valLower = value.toLowerCase();

    if (key === 'warehouse') {
      return Array.from(new Set(warehouses.map((w: any) => String(w.name || ''))))
        .filter((name: string) => name.toLowerCase().includes(valLower))
        .map((name: string) => `warehouse:"${name}"`);
    }
    if (key === 'supplier') {
      return Array.from(new Set(suppliers.map((s: any) => String(s.name || ''))))
        .filter((name: string) => name.toLowerCase().includes(valLower))
        .map((name: string) => `supplier:"${name}"`);
    }
    if (key === 'category') {
      return Array.from(new Set(categories.map((c: any) => String(c.name || ''))))
        .filter((name: string) => name.toLowerCase().includes(valLower))
        .map((name: string) => `category:"${name}"`);
    }
    if (key === 'product') {
      return Array.from(new Set(products.map((p: any) => String(p.name || ''))))
        .filter((name: string) => name.toLowerCase().includes(valLower))
        .map((name: string) => `product:"${name}"`);
    }
    if (key === 'sku') {
      return Array.from(new Set(products.map((p: any) => String(p.sku || ''))))
        .filter((sku: string) => sku.toLowerCase().includes(valLower))
        .map((sku: string) => `sku:${sku}`);
    }
    if (key === 'variant') {
      const filteredProductIds = products
        .filter((product: any) => {
          const productFilters = activeFilters.product || [];
          if (productFilters.length === 0) return true;
          return productFilters.some((productName) => String(product.name || '').toLowerCase().includes(productName));
        })
        .map((product: any) => product.id);

      return Array.from(new Set(
        variants
          .filter((variant: any) => filteredProductIds.includes(variant.product_id))
          .map((variant: any) => String(variant.variant_code || ''))
      ))
        .filter((code: string) => code.toLowerCase().includes(valLower))
        .map((code: string) => `variant:${code}`);
    }
    if (key === 'barcode') {
      return Array.from(new Set(variants.map((v: any) => String(v.barcode || ''))))
        .filter((code: string) => code.toLowerCase().includes(valLower))
        .map((code: string) => `barcode:${code}`);
    }
    if (key === 'type') {
      return Array.from(new Set(movements.map((movement: any) => String(movement.movement_type || ''))))
        .filter((type: string) => type.toLowerCase().includes(valLower))
        .map((type: string) => `type:${type}`);
    }

    return [];
  };

  return (
    <div className="app-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="app-title">Dashboard</h1>
          <p className="app-subtitle">Real-time stock levels across all warehouses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSeed}
            className="app-button-muted"
          >
            {isDemoMode ? 'Reset Demo Data' : 'Seed Data'}
          </button>
          <button
            onClick={handleBigSeed}
            className="app-button-secondary"
          >
            <Plus className="w-4 h-4" />
            {isDemoMode ? 'Reload Demo Dataset' : 'Big Seed'}
          </button>
          <button
            onClick={handleClearAllData}
            className="app-button-danger"
          >
            {isDemoMode ? 'Clear Demo Data' : 'Clear All Data'}
          </button>
          {isDemoMode && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Demo Mode Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="app-surface p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-gray-500 font-medium">In Stock</span>
          </div>
          <p className="text-3xl font-semibold">{totalStockUnits.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">Available for immediate use</p>
        </div>
        <div className="app-surface p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-gray-500 font-medium">Total Value</span>
          </div>
          <p className="text-3xl font-semibold">${totalStockValue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">Estimated market value</p>
        </div>
        <div className="app-surface p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-gray-500 font-medium">Warehouses</span>
          </div>
          <p className="text-3xl font-semibold">{filteredWarehousesCount}</p>
          <p className="text-xs text-gray-400 mt-2">Active distribution centers</p>
        </div>
        <div className="app-surface p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-gray-500 font-medium">Suppliers</span>
          </div>
          <p className="text-3xl font-semibold">{filteredSuppliersCount}</p>
          <p className="text-xs text-gray-400 mt-2">Active supply partners</p>
        </div>
      </div>

      <div className="app-surface overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <AutocompleteSearch
                value={searchTerm}
                onChange={setSearchTerm}
                suggestions={getSuggestions()}
                placeholder="Search buy/sell transfers (e.g., warehouse:north)..."
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
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1">
              <div className="flex flex-col">
                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">From</label>
                <input
                  type="datetime-local"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="text-[10px] font-bold outline-none bg-transparent"
                />
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex flex-col">
                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">To</label>
                <input
                  type="datetime-local"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="text-[10px] font-bold outline-none bg-transparent"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                  className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="app-button-secondary shrink-0"
          >
            <ArrowRightLeft className="w-5 h-5" />
            Transfer
          </button>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-450px)] overscroll-contain">
          <table className="w-full text-left min-w-[920px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Product Name</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Quantity</th>
                <th className="px-6 py-4 font-semibold">Warehouse</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">Loading...</td>
                </tr>
              ) : filteredTransferRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="bg-gray-50 p-6 rounded-full">
                        <Package className="w-12 h-12 text-gray-300" />
                      </div>
                      <div className="max-w-xs mx-auto">
                        <h3 className="text-lg font-semibold text-gray-900">No buy or sell transfers found</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          No receipt or issue activity matches the current filters.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSeed}
                          className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                        >
                          Basic Seed
                        </button>
                        <button
                          onClick={handleBigSeed}
                          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                          Big Seed (Full Features)
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredTransferRows.map((movement) => {
                const variant = variants.find(v => v.id === movement.variant_id);
                const product = variant ? products.find(p => p.id === variant.product_id) : null;
                const supplier = product ? suppliers.find(s => s.id === product.supplier_id) : null;
                const category = product ? categories.find(c => c.id === product.category_id) : null;
                const movementTypeMeta = getMovementTypeMeta(movement?.movement_type);
                return (
                  <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleMovementClick(movement)}
                        className="text-xs font-mono text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer"
                      >
                        {movement.id.slice(0, 8)}...
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <button
                            onClick={() => handleProductClick(movement.variant_id)}
                            className="text-sm font-bold text-gray-800 hover:text-indigo-600 hover:underline text-left"
                          >
                            {getProductName(movement.variant_id)}
                          </button>
                          <button
                            onClick={() => handleVariantClick(movement.variant_id)}
                            className="text-xs text-gray-500 hover:text-indigo-600 hover:underline block text-left"
                          >
                            {getVariantName(movement.variant_id)}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(product?.category_id)}
                        className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        {category?.name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex px-2 py-1 rounded-lg text-xs font-bold uppercase", movementTypeMeta.className)}>
                        {movementTypeMeta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-800">
                        {movement.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleItemDetailsClick({
                            id: movement.id,
                            variant_id: movement.variant_id,
                            warehouse_id: movement.warehouse_id,
                            available_quantity: balances.find((balance) => balance.variant_id === movement.variant_id && balance.warehouse_id === movement.warehouse_id)?.available_quantity || 0,
                            reserved_quantity: balances.find((balance) => balance.variant_id === movement.variant_id && balance.warehouse_id === movement.warehouse_id)?.reserved_quantity || 0,
                          })}
                          className="flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer"
                        >
                          <WarehouseIcon className="w-4 h-4" />
                          {getWarehouseName(movement.warehouse_id)}
                        </button>
                        <button
                          onClick={() => handleWarehouseClick(movement.warehouse_id)}
                          className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                          title="Warehouse Details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleSupplierClick(product?.supplier_id)}
                        className="text-sm font-medium text-gray-700 hover:text-indigo-600 hover:underline"
                      >
                        {supplier?.name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {formatDateTime(movement.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Modal */}
      <AnimatePresence>
        {isReceiveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReceiveModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
              <h3 className="text-xl font-bold mb-6">Receive Stock</h3>
              <form onSubmit={handleReceive} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Variant</label>
                  <select required value={formData.variant_id || ''} onChange={e => setFormData({ ...formData, variant_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Variant</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.variant_code} ({v.barcode})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Warehouse</label>
                  <select required value={formData.warehouse_id || ''} onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                  <input type="number" required min="1" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button>
                  <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-semibold">Receive</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deliver Modal */}
      <AnimatePresence>
        {isIssueModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsIssueModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
              <h3 className="text-xl font-bold mb-6">Deliver Stock</h3>
              <form onSubmit={handleIssue} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Warehouse</label>
                  <select required value={formData.warehouse_id || ''} onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Variant (Available in Warehouse)</label>
                  <select required value={formData.variant_id || ''} onChange={e => setFormData({ ...formData, variant_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Variant</option>
                    {variants
                      .filter(v => !formData.warehouse_id || balances.some(b => b.variant_id === v.id && b.warehouse_id === formData.warehouse_id))
                      .map(v => {
                        const balance = balances.find(b => b.variant_id === v.id && b.warehouse_id === formData.warehouse_id);
                        const qty = balance?.available_quantity || 0;
                        return (
                          <option key={v.id} value={v.id} disabled={qty <= 0}>
                            {v.variant_code} - {v.barcode} ({qty} available)
                          </option>
                        );
                      })
                    }
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                    <input type="number" required min="1" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Unit Price ($)</label>
                    <input type="number" required min="0" step="0.01" value={formData.unit_price || ''} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Client</label>
                  <select required value={formData.client_id || ''} onChange={e => setFormData({ ...formData, client_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsIssueModalOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button>
                  <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-semibold">Deliver</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
              <h3 className="text-xl font-bold mb-6">Transfer Stock</h3>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Variant</label>
                  <select required value={formData.variant_id || ''} onChange={e => setFormData({ ...formData, variant_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                    <option value="">Select Variant</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.variant_code} ({v.barcode})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">From</label>
                    <select required value={formData.from_warehouse_id || ''} onChange={e => setFormData({ ...formData, from_warehouse_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                      <option value="">Source</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">To</label>
                    <select required value={formData.to_warehouse_id || ''} onChange={e => setFormData({ ...formData, to_warehouse_id: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4">
                      <option value="">Destination</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                  <input type="number" required min="1" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-semibold">Cancel</button>
                  <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-semibold">Transfer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revenue Invoice Modal */}
      <AnimatePresence>
        {isInvoiceModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInvoiceModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 overflow-hidden flex flex-col border border-white/20"
            >
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <DollarSign className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">Sales Receipt</h3>
                    <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">
                      Invoice #{selectedInvoice.invoice_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="p-6 bg-gray-50/50 rounded-3xl border border-gray-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Users className="w-16 h-16" />
                  </div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Billed To</label>
                  <p className="text-xl font-black text-gray-800">{selectedInvoice.customer_name}</p>
                  {selectedInvoice.client_id && (
                    <p className="text-[10px] text-gray-500 font-medium">
                      {clients.find(c => c.id === selectedInvoice.client_id)?.email || 'Customer'}
                    </p>
                  )}
                </div>
                <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <WarehouseIcon className="w-16 h-16" />
                  </div>
                  <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-2">Issued From</label>
                  <p className="text-xl font-black text-emerald-900">{getWarehouseName(selectedInvoice.warehouse_id)}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">Fulfillment Center</p>
                </div>
              </div>

              <div className="border border-gray-100 rounded-[2rem] overflow-hidden mb-10">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-6 py-4 text-right">Qty</th>
                      <th className="px-6 py-4 text-right">Price</th>
                      <th className="px-6 py-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedInvoice.items.map((item: any, idx: number) => (
                      <tr key={idx} className="text-sm">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-800">{getProductName(item.variant_id)}</p>
                          <p className="text-[10px] font-mono text-gray-500 mt-1">{getVariantName(item.variant_id).split(' ')[0]}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-600">{item.quantity}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-600">${item.unit_price.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-gray-900">${item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-gray-50/50 p-6 flex justify-between items-center border-t border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount</span>
                  <span className="text-3xl font-black text-emerald-600">${selectedInvoice.total_amount.toLocaleString()}</span>
                </div>
                {(selectedInvoice.cogs_amount !== undefined || selectedInvoice.gross_profit !== undefined) && (
                  <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-white p-6 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cost / Unit</p>
                      <p className="mt-2 text-lg font-black text-gray-900">${Number(selectedInvoice.cost_per_unit_at_sale || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">COGS</p>
                      <p className="mt-2 text-lg font-black text-amber-900">${Number(selectedInvoice.cogs_amount || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Gross Profit</p>
                      <p className="mt-2 text-lg font-black text-emerald-900">${Number(selectedInvoice.gross_profit || 0).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-6 bg-gray-50/80 rounded-3xl mb-10 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <Info className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Issue Date</label>
                    <p className="text-sm font-bold text-gray-800">{formatDateTime(selectedInvoice.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Status</label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100 inline-block mt-1">
                    {selectedInvoice.status || 'Completed'}
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all shadow-sm active:scale-95"
                >
                  Close Receipt
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  Print Invoice
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Movement History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <HistoryIcon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Inventory Item Details</h3>
                    <p className="text-gray-500 text-sm">#{selectedHistory.balance.id.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Available Quantity</label>
                  <p className="text-2xl font-black text-gray-900">{selectedHistory.balance.available_quantity}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Reserved Quantity</label>
                  <p className="text-2xl font-black text-gray-900">{selectedHistory.balance.reserved_quantity}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Warehouse</label>
                  <p className="text-sm font-bold text-gray-800">{getWarehouseName(selectedHistory.balance.warehouse_id)}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock Movement History</h4>
                  <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                    <div className="flex flex-col px-2">
                      <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">From</label>
                      <input
                        type="datetime-local"
                        value={historyDateFrom}
                        onChange={(e) => setHistoryDateFrom(e.target.value)}
                        className="text-[10px] font-bold outline-none bg-transparent"
                      />
                    </div>
                    <div className="w-px h-6 bg-gray-200" />
                    <div className="flex flex-col px-2">
                      <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">To</label>
                      <input
                        type="datetime-local"
                        value={historyDateTo}
                        onChange={(e) => setHistoryDateTo(e.target.value)}
                        className="text-[10px] font-bold outline-none bg-transparent"
                      />
                    </div>
                    {(historyDateFrom || historyDateTo) && (
                      <button
                        onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }}
                        className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl max-h-[300px]">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3 text-right">Qty</th>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedHistory.history
                        .filter((m: any) => {
                          const timestamp = toTimestampMs(m.timestamp, -Infinity);
                          const from = historyDateFrom ? toTimestampMs(historyDateFrom) : 0;
                          const to = historyDateTo ? toTimestampMs(historyDateTo) : Infinity;
                          return timestamp >= from && timestamp <= to;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No movement history found for the selected range.</td>
                        </tr>
                      ) : selectedHistory.history
                        .filter((m: any) => {
                          const timestamp = toTimestampMs(m.timestamp, -Infinity);
                          const from = historyDateFrom ? toTimestampMs(historyDateFrom) : 0;
                          const to = historyDateTo ? toTimestampMs(historyDateTo) : Infinity;
                          return timestamp >= from && timestamp <= to;
                        })
                        .map((m: any, idx: number) => (
                          <tr key={idx} className="text-sm hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleMovementClick(m)}
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase hover:underline cursor-pointer",
                                  ['issue', 'transfer_out'].includes(m.movement_type) ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                                )}
                              >
                                {getMovementDisplayLabel(m)}
                              </button>
                            </td>
                            <td className={`px-6 py-4 text-right font-bold ${isOutgoingMovement(m) ? 'text-red-600' : 'text-green-600'}`}>
                              {isOutgoingMovement(m) ? '-' : '+'}{m.quantity}
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-xs">
                              {formatDateTime(m.timestamp)}
                            </td>
                            <td className="px-6 py-4 text-gray-400 text-xs truncate max-w-[200px]">
                              {m.notes || '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsHistoryModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {isProductModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProductModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-200">
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-indigo-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedProduct.name}</h3>
                    <p className="text-gray-500 font-mono text-sm">SKU: {selectedProduct.sku}</p>
                  </div>
                </div>
                <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Brand & Category</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                      {selectedProduct.brand_logo_url ? (
                        <img
                          src={selectedProduct.brand_logo_url}
                          alt={selectedProduct.brand_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase">No Logo</span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-800">{selectedProduct.brand_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(selectedProduct.category_id)}
                    className="text-xs text-gray-500 hover:text-indigo-600 hover:underline"
                  >
                    {selectedProduct.category_name}
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Variants</label>
                  <p className="text-3xl font-black text-gray-900">{selectedProduct.variants.length}</p>
                  <p className="text-xs text-gray-500">Click a variant below to open full details</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Supplier Info</label>
                  <button
                    type="button"
                    onClick={() => handleSupplierClick(selectedProduct.supplier_id)}
                    className="text-sm font-bold text-gray-800 hover:text-indigo-600 hover:underline"
                  >
                    {selectedProduct.supplier_name}
                  </button>
                  <p className="text-xs text-gray-500">Primary Provider</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Stock</label>
                  <p className="text-3xl font-black text-gray-900">
                    {selectedProduct.distribution.reduce((acc: number, b: any) => acc + b.quantity, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Across {selectedProduct.distribution.length} warehouses</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Variants</h4>
                <div className="space-y-2">
                  {selectedProduct.variants.map((variant: any) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        setIsProductModalOpen(false);
                        handleVariantClick(variant.id);
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

              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Warehouse Distribution</h4>
                <div className="space-y-2">
                  {selectedProduct.distribution.map((b: any) => (
                    <div key={b.warehouse_id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">{getWarehouseName(b.warehouse_id)}</span>
                      </div>
                      <span className="text-sm font-bold">{b.quantity} units</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsProductModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800">
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variant Details Modal */}
      <AnimatePresence>
        {isVariantModalOpen && selectedVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsVariantModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-200">
                    {selectedVariant.photo_url ? (
                      <img
                        src={selectedVariant.photo_url}
                        alt={selectedVariant.variant_code}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Package className="w-8 h-8 mb-1 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">No Photo</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedVariant.product_name}</h3>
                    <p className="text-indigo-600 font-bold">{selectedVariant.variant_code}</p>
                    <p className="text-gray-500 font-mono text-xs">SKU: {selectedVariant.sku}</p>
                  </div>
                </div>
                <button onClick={() => setIsVariantModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Barcode</label>
                  <p className="text-sm font-bold text-gray-800">{selectedVariant.barcode || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Brand</label>
                  <p className="text-sm font-bold text-gray-800">{selectedVariant.brand_name || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Category</label>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(selectedVariant.category_id)}
                    className="text-sm font-bold text-gray-800 hover:text-indigo-600 hover:underline"
                  >
                    {selectedVariant.category_name || 'N/A'}
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Supplier</label>
                  <button
                    type="button"
                    onClick={() => handleSupplierClick(selectedVariant.supplier_id)}
                    className="text-sm font-bold text-gray-800 hover:text-indigo-600 hover:underline"
                  >
                    {selectedVariant.supplier_name || 'N/A'}
                  </button>
                </div>
              </div>

              {selectedVariant.attributes && Object.keys(selectedVariant.attributes).length > 0 && (
                <div className="mb-8">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Attributes</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedVariant.attributes).map(([key, value]: [string, any]) => (
                      <div key={key} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                        <span className="opacity-60 uppercase mr-1">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Warehouse Distribution</h4>
                  <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg">
                    Total: {selectedVariant.distribution.reduce((acc: number, b: any) => acc + b.available_quantity, 0)} units
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedVariant.distribution.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">{getWarehouseName(b.warehouse_id)}</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600">{b.available_quantity}</span>
                    </div>
                  ))}
                  {selectedVariant.distribution.length === 0 && (
                    <div className="col-span-full p-8 text-center bg-gray-50 rounded-2xl text-gray-400 text-sm italic">
                      No stock available in any warehouse.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsVariantModalOpen(false);
                    handleProductClick(selectedVariant.id);
                  }}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  View Product
                </button>
                <button onClick={() => setIsVariantModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Warehouse Details Modal */}
      <AnimatePresence>
        {/* Movement Details Modal */}
        {isMovementModalOpen && selectedMovement && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMovementModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <HistoryIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Movement Details</h3>
                    <p className="text-gray-500 text-sm">#{selectedMovement.id.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setIsMovementModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                  <p className="text-lg font-bold capitalize">{getMovementDisplayLabel(selectedMovement)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Quantity</label>
                  <p className={cn(
                    "text-lg font-bold",
                    isOutgoingMovement(selectedMovement) ? "text-red-600" : "text-green-600"
                  )}>
                    {isOutgoingMovement(selectedMovement) ? '-' : '+'}{selectedMovement.quantity}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Warehouse</label>
                  <p className="text-lg font-bold">{getWarehouseName(selectedMovement.warehouse_id)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Timestamp</label>
                  <p className="text-lg font-bold">{formatDateTime(selectedMovement.timestamp)}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl mb-8">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Product Variant</label>
                <p className="text-lg font-bold">{getProductName(selectedMovement.variant_id)} - {getVariantName(selectedMovement.variant_id)}</p>

                {['transfer_in', 'transfer_out'].includes(selectedMovement.movement_type) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        const inv = transferInvoices.find(i => i.movement_in_id === selectedMovement.id || i.movement_out_id === selectedMovement.id);
                        if (inv) {
                          setSelectedTransferInvoice(inv);
                          setIsTransferInvoiceModalOpen(true);
                          setIsMovementModalOpen(false);
                        } else {
                          toast.info('No transfer invoice record found for this movement.');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm"
                    >
                      <List className="w-4 h-4" />
                      View Transfer Invoice
                    </button>
                  </div>
                )}

                {selectedMovement.movement_type === 'return' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        const invoice = returnInvoices.find((entry) => entry.movement_id === selectedMovement.id);
                        if (invoice) {
                          setSelectedTransferInvoice(invoice);
                          setIsTransferInvoiceModalOpen(true);
                          setIsMovementModalOpen(false);
                        } else {
                          toast.info('No return invoice record found for this movement.');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-xl font-bold hover:bg-amber-100 transition-all shadow-sm"
                    >
                      <List className="w-4 h-4" />
                      View Return Invoice
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl flex-1 overflow-y-auto">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Notes / Reference</label>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedMovement.notes || 'No notes provided.'}</p>
                {selectedMovement.idempotency_key && (
                  <p className="mt-4 text-[10px] text-gray-400 font-mono">Key: {selectedMovement.idempotency_key}</p>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsMovementModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isWarehouseModalOpen && selectedWarehouse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWarehouseModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <WarehouseIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedWarehouse.name}</h3>
                    <p className="text-gray-500 text-sm">{selectedWarehouse.location}, {selectedWarehouse.country}</p>
                  </div>
                </div>
                <button onClick={() => setIsWarehouseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Warehouse Manager</label>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                        selectedWarehouse.is_system_manager ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-600"
                      )}>
                        {selectedWarehouse.is_system_manager ? 'System User' : 'Manual Record'}
                      </span>
                      {(() => {
                        const isSystemManager = Boolean(selectedWarehouse.manager_id);
                        const isManager = user && (user.email === selectedWarehouse.manager_email || user.uid === selectedWarehouse.manager_id);
                        const isMissingInfo = !selectedWarehouse.manager_phone || !selectedWarehouse.manager_email;

                        if (isEditingManagerInfo) return null;

                        if (isSystemManager) return null;

                        if (isManager) {
                          return (
                            <button
                              onClick={() => {
                                setManagerFormData({
                                  phone: selectedWarehouse.manager_phone || '',
                                  email: selectedWarehouse.manager_email || ''
                                });
                                setIsEditingManagerInfo(true);
                              }}
                              className="text-[8px] font-black uppercase text-indigo-600 hover:underline"
                            >
                              Edit Info
                            </button>
                          );
                        }

                        if (isMissingInfo) {
                          return (
                            <button
                              onClick={() => {
                                setManagerFormData({
                                  phone: selectedWarehouse.manager_phone || '',
                                  email: selectedWarehouse.manager_email || ''
                                });
                                setIsEditingManagerInfo(true);
                              }}
                              className="text-[8px] font-black uppercase text-indigo-600 hover:underline"
                            >
                              Add Info
                            </button>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>

                  {isEditingManagerInfo ? (
                    <form onSubmit={handleManagerInfoUpdate} className="space-y-2 mt-2">
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={managerFormData.phone}
                        onChange={(e) => setManagerFormData({ ...managerFormData, phone: e.target.value })}
                        className="bg-white border-gray-200 rounded-lg py-1.5 px-3 text-xs w-full focus:ring-1 focus:ring-black"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={managerFormData.email}
                        onChange={(e) => setManagerFormData({ ...managerFormData, email: e.target.value })}
                        className="bg-white border-gray-200 rounded-lg py-1.5 px-3 text-xs w-full focus:ring-1 focus:ring-black"
                      />
                      <div className="flex gap-1.5">
                        <button type="submit" className="flex-1 bg-black text-white py-1.5 rounded-lg text-[10px] font-bold">Save</button>
                        <button type="button" onClick={() => setIsEditingManagerInfo(false)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-[10px] font-bold">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-gray-800">{selectedWarehouse.manager_name}</p>
                      <p className="text-xs text-gray-500">{selectedWarehouse.manager_email || 'No email'}</p>
                      {selectedWarehouse.manager_phone && (
                        <p className="text-xs text-indigo-600 font-semibold mt-1">{selectedWarehouse.manager_phone}</p>
                      )}
                    </>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Location Details</label>
                  <p className="text-sm font-bold text-gray-800">{selectedWarehouse.location}</p>
                  <p className="text-xs text-gray-500">{selectedWarehouse.country}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Items</label>
                  <p className="text-xl font-bold text-gray-800">{selectedWarehouse.balances.length}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Quantity</label>
                  <p className="text-xl font-bold text-gray-800">
                    {selectedWarehouse.balances.reduce((acc: number, b: any) => acc + b.available_quantity, 0)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3">Variant</th>
                      <th className="px-6 py-3 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedWarehouse.balances.map((b: any) => (
                      <tr key={b.id} className="text-sm">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{getProductName(b.variant_id)}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            {(() => {
                              const v = variants.find(v => v.id === b.variant_id);
                              const p = v ? products.find(p => p.id === v.product_id) : null;
                              const s = p ? suppliers.find(s => s.id === p.supplier_id) : null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleSupplierClick(s?.id)}
                                  className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide hover:underline"
                                >
                                  {s?.name || 'N/A'}
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{getVariantName(b.variant_id)}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-800">{b.available_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsWarehouseModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800">
                  Close Warehouse
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCategoryModalOpen && selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Category Details</p>
                  <h3 className="text-3xl font-black text-gray-900 mt-2">{selectedCategory.name}</h3>
                  <p className="text-sm text-gray-500 mt-2">{selectedCategory.description || 'No description provided.'}</p>
                </div>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Category Code</label>
                  <p className="text-sm font-bold text-gray-800">{selectedCategory.category_code || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Parent Category</label>
                  <p className="text-sm font-bold text-gray-800">
                    {categories.find((entry) => entry.id === selectedCategory.parent_category_id)?.name || 'Top Level'}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Child Categories</label>
                  {selectedCategory.childCategories?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCategory.childCategories.map((category: any) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleCategoryClick(category.id)}
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

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Related Products</label>
                  {selectedCategory.relatedProducts?.length > 0 ? (
                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-widest">
                          <tr>
                            <th className="px-4 py-3 font-bold">Name</th>
                            <th className="px-4 py-3 font-bold">SKU</th>
                            <th className="px-4 py-3 font-bold">Variants</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedCategory.relatedProducts.map((product: any) => (
                            <tr key={product.id}>
                              <td className="px-4 py-3 font-semibold text-gray-800">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCategoryModalOpen(false);
                                    handleProductClick(product.variants?.[0]?.id);
                                  }}
                                  className="hover:text-indigo-600 hover:underline"
                                >
                                  {product.name}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-gray-500">{product.sku || 'N/A'}</td>
                              <td className="px-4 py-3 text-gray-500">{product.variants?.length || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No products linked to this category.</p>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-8 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Created At</label>
                  <p className="text-xs text-gray-500">
                    {selectedCategory.created_at ? new Date(selectedCategory.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Last Modified</label>
                  <p className="text-xs text-gray-500">
                    {selectedCategory.last_modified ? new Date(selectedCategory.last_modified).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSupplierModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSupplierModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Supplier</p>
                  <h3 className="text-2xl font-bold">{selectedSupplier.name}</h3>
                  <p className="text-sm text-gray-500">{selectedSupplier.supplier_code || 'No Supplier ID'}</p>
                </div>
                <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Email</label>
                  <p className="text-sm font-bold text-gray-800">{selectedSupplier.email || selectedSupplier.contact_info || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Phone</label>
                  <p className="text-sm font-bold text-gray-800">{selectedSupplier.phone || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Country</label>
                  <p className="text-sm font-bold text-gray-800">{selectedSupplier.country || 'N/A'}</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsSupplierModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800">
                  Close Supplier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Transfer Invoice Modal */}
      <AnimatePresence>
        {isTransferInvoiceModalOpen && selectedTransferInvoice && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransferInvoiceModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 overflow-hidden flex flex-col border border-white/20"
            >
              {(() => {
                const isReturnInvoice = Boolean(selectedTransferInvoice.return_scope);
                return (
                  <>
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-5">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${isReturnInvoice ? 'bg-gradient-to-br from-amber-500 to-rose-500 shadow-orange-200' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-200'}`}>
                    <List className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">{isReturnInvoice ? 'Return Invoice' : 'Transfer Receipt'}</h3>
                    <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">
                      Invoice #{selectedTransferInvoice.invoice_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTransferInvoiceModalOpen(false)}
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className={`p-6 rounded-3xl border relative overflow-hidden group ${isReturnInvoice ? 'bg-gray-50/50 border-gray-100' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ArrowRightLeft className="w-16 h-16" />
                  </div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">{isReturnInvoice ? 'Customer' : 'Source Location'}</label>
                  <p className="text-xl font-black text-gray-800">{isReturnInvoice ? (selectedTransferInvoice.customer_name || 'N/A') : getWarehouseName(selectedTransferInvoice.from_warehouse_id)}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{isReturnInvoice ? (selectedTransferInvoice.return_scope === 'sale' ? 'Return from sale' : 'Return from buy') : 'Outgoing Transfer'}</p>
                </div>
                <div className={`p-6 rounded-3xl border relative overflow-hidden group ${isReturnInvoice ? 'bg-amber-50/50 border-amber-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ArrowRightLeft className="w-16 h-16" />
                  </div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isReturnInvoice ? 'text-amber-500' : 'text-indigo-400'}`}>{isReturnInvoice ? 'Warehouse' : 'Destination'}</label>
                  <p className={`text-xl font-black ${isReturnInvoice ? 'text-amber-900' : 'text-indigo-900'}`}>{getWarehouseName(selectedTransferInvoice.warehouse_id || selectedTransferInvoice.to_warehouse_id)}</p>
                  <p className={`text-[10px] font-medium ${isReturnInvoice ? 'text-amber-500' : 'text-indigo-400'}`}>{isReturnInvoice ? (selectedTransferInvoice.return_direction === 'out' ? 'Stock moved out on return' : 'Stock moved back in on return') : 'Incoming Transfer'}</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-100 rounded-[2rem] p-8 mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Movement Details</h4>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider border border-green-100 italic">Verified & Processed</span>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Product Name</span>
                    <span className="font-bold text-gray-800">{getProductName(selectedTransferInvoice.variant_id || selectedTransferInvoice.product_variant_id)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Variant Code</span>
                    <span className="font-bold text-indigo-600 font-mono tracking-tight">{getVariantName(selectedTransferInvoice.variant_id || selectedTransferInvoice.product_variant_id).split(' ')[0]}</span>
                  </div>
                  {isReturnInvoice && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Amount</span>
                      <span className="font-bold text-gray-800">${Number(selectedTransferInvoice.total_amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {!isReturnInvoice && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">COGS</span>
                        <span className="font-bold text-amber-700">${Number(selectedTransferInvoice.cogs_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Gross Profit</span>
                        <span className="font-bold text-emerald-700">${Number(selectedTransferInvoice.gross_profit || 0).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center text-sm pt-6 border-t border-gray-50">
                    <span className="text-gray-500 font-black uppercase tracking-widest text-[10px]">{isReturnInvoice ? 'Returned Quantity' : 'Transferred Quantity'}</span>
                    <span className="text-3xl font-black text-gray-900">{selectedTransferInvoice.quantity} units</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-gray-50/80 rounded-3xl mb-10 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <Info className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none">Processed Date</label>
                    <p className="text-sm font-bold text-gray-800">{formatDateTime(selectedTransferInvoice.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none">{isReturnInvoice ? 'Status' : 'Operator ID'}</label>
                  <p className="text-xs font-mono font-bold text-gray-800 truncate max-w-[120px]">
                    {isReturnInvoice ? (selectedTransferInvoice.status || 'completed') : (selectedTransferInvoice.created_by || 'SYSTEM')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsTransferInvoiceModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all shadow-sm active:scale-95"
                >
                  Close Invoice
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                >
                  Print Invoice
                </button>
              </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
