import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import {
  ShoppingCart,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Package,
  Plus,
  ChevronRight,
  Download,
  Filter,
  Calendar
  ,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Product, ProductVariant, PurchaseOrder, Supplier, Warehouse, InventoryBalance, Backorder } from '../types';
import { seedBigData } from '../lib/seed';

export default function ProcurementDashboard() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const handleSupplierClick = (supplierId?: string) => {
    if (!supplierId) return;
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return;
    setSelectedSupplier(supplier);
  };

  const handleBigSeed = async () => {
    const loadingToast = toast.loading('Seeding large data batch...');
    try {
      await seedBigData();
      toast.dismiss(loadingToast);
      toast.success('Large data batch seeded successfully');
    } catch (error) {
      console.error(error);
      toast.dismiss(loadingToast);
      toast.error('Big seeding failed');
    }
  };

  useEffect(() => {
    setLoading(true);
    const handleError = (err: any) => {
      console.error(err);
      toast.error('Failed to sync procurement data');
    };

    const unsubVariants = onSnapshot(collection(db, 'product_variants'), (s) => {
      setVariants(s.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant)));
    }, handleError);

    const unsubProducts = onSnapshot(collection(db, 'products'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, handleError);

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (s) => {
      setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    }, handleError);

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    }, handleError);

    const unsubBalances = onSnapshot(collection(db, 'inventory_balances'), (s) => {
      setBalances(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalance)));
    }, handleError);

    const unsubPOs = onSnapshot(query(collection(db, 'purchase_orders'), orderBy('created_at', 'desc')), (s) => {
      setPurchaseOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, handleError);

    const unsubBackorders = onSnapshot(query(collection(db, 'backorders'), where('status', '==', 'pending')), (s) => {
      setBackorders(s.docs.map(d => ({ id: d.id, ...d.data() } as Backorder)));
      setLoading(false);
    }, handleError);

    return () => {
      unsubVariants();
      unsubProducts();
      unsubSuppliers();
      unsubWarehouses();
      unsubBalances();
      unsubPOs();
      unsubBackorders();
    };
  }, []);

  const getIncomingQty = (variantId: string) => {
    return purchaseOrders
      .filter(po => ['sent', 'in_transit'].includes(po.status))
      .reduce((acc, po) => {
        const item = po.items.find(i => i.variant_id === variantId);
        return acc + (item?.quantity || 0);
      }, 0);
  };

  const recommendations = variants.map(v => {
    const variantBalances = balances.filter(b => b.variant_id === v.id && (selectedWarehouseId === 'all' || b.warehouse_id === selectedWarehouseId));
    const currentStock = variantBalances.reduce((acc, b) => acc + b.available_quantity, 0);
    const incomingQty = getIncomingQty(v.id || '');
    const threshold = v.reorder_threshold || 10;

    if (currentStock + incomingQty < threshold) {
      const suggestedQty = (threshold * 2) - currentStock - incomingQty;
      const product = products.find(p => p.id === v.product_id);
      return {
        variant: v,
        currentStock,
        incomingQty,
        threshold,
        suggestedQty: Math.max(0, suggestedQty),
        supplier: suppliers.find(s => s.id === product?.supplier_id) || { name: 'Unknown Supplier' }
      };
    }
    return null;
  }).filter(Boolean);

  const incomingByVariant = variants.map(v => {
    const qty = getIncomingQty(v.id || '');
    if (qty > 0) {
      const pos = purchaseOrders.filter(po => ['sent', 'in_transit'].includes(po.status) && po.items.some(i => i.variant_id === v.id));
      return { variant: v, qty, pos };
    }
    return null;
  }).filter(Boolean);

  const handleCreatePO = async (rec: any) => {
    try {
      const product = products.find(p => p.id === rec.variant.product_id);
      const po: Omit<PurchaseOrder, 'id'> = {
        supplier_id: product?.supplier_id || 'manual',
        warehouse_id: selectedWarehouseId === 'all' ? warehouses[0]?.id || '' : selectedWarehouseId,
        items: [{
          variant_id: rec.variant.id,
          quantity: rec.suggestedQty,
          unit_cost: rec.variant.unit_cost || 0
        }],
        total_amount: rec.suggestedQty * (rec.variant.unit_cost || 0),
        status: 'draft',
        expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'purchase_orders'), po);
      toast.success(`Draft PO created for ${rec.variant.variant_code}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create PO');
    }
  };

  const formatDateTime = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Procurement Dashboard...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage supplier orders and stock replenishment. Last updated: {formatDateTime(new Date())}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="text-sm font-bold bg-transparent outline-none"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button
            onClick={handleBigSeed}
            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-100 transition-all text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Big Seed
          </button>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <Download className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 1. Reorder Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-500" />
                Reorder Recommendations
              </h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Action Required</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest">
                    <th className="px-6 py-4 font-bold">Variant</th>
                    <th className="px-6 py-4 font-bold">Supplier</th>
                    <th className="px-6 py-4 font-bold">Stock / Threshold</th>
                    <th className="px-6 py-4 font-bold">Suggested</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">All stock levels healthy ✓</td>
                    </tr>
                  ) : recommendations.map((rec: any) => (
                    <tr key={rec.variant.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{rec.variant.variant_code}</p>
                        <p className="text-[10px] text-gray-400">SKU: {rec.variant.barcode}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleSupplierClick(rec.supplier.id)}
                          className="text-sm text-gray-600 hover:text-indigo-600 hover:underline"
                        >
                          {rec.supplier.name}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-500">{rec.currentStock}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-sm text-gray-500">{rec.threshold}</span>
                          {rec.incomingQty > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">
                              +{rec.incomingQty} inbound
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-indigo-600">{rec.suggestedQty}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCreatePO(rec)}
                          className="bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-all opacity-0 group-hover:opacity-100"
                        >
                          Create PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Open Purchase Orders */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-500" />
                Open Purchase Orders
              </h3>
              <button className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {purchaseOrders.filter(po => ['sent', 'in_transit', 'overdue'].includes(po.status)).slice(0, 4).map(po => (
                <div key={po.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">PO #{po.id?.slice(-4).toUpperCase()}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleSupplierClick(po.supplier_id)}
                      className="font-bold text-sm hover:text-indigo-600 hover:underline"
                    >
                      {suppliers.find(s => s.id === po.supplier_id)?.name}
                    </button>
                    <p className="text-xs text-gray-500">${po.total_amount.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Calendar className="w-3 h-3" />
                      Expected: {formatDateTime(po.expected_delivery_date)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              ))}
              {purchaseOrders.length === 0 && <p className="col-span-2 text-center py-8 text-gray-400 italic">No open orders</p>}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* 4. Incoming Stock by Variant */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Incoming Stock
            </h3>
            <div className="space-y-4">
              {incomingByVariant.length === 0 ? (
                <p className="text-center py-8 text-gray-400 italic">No inbound stock</p>
              ) : incomingByVariant.map((item: any) => (
                <div key={item.variant.id} className="p-4 rounded-2xl bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{item.variant.variant_code}</span>
                    <span className="text-sm font-black text-green-600">+{item.qty}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.pos.map((po: any) => (
                      <span key={po.id} className="text-[8px] font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-400">
                        PO #{po.id?.slice(-4).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Backorder Queue */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Backorder Queue
            </h3>
            <div className="space-y-4">
              {backorders.length === 0 ? (
                <div className="py-8 text-center text-green-600 font-medium flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  Queue is empty ✓
                </div>
              ) : backorders.map(bo => (
                <div key={bo.id} className="flex items-center justify-between p-3 rounded-2xl bg-red-50 border border-red-100">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{variants.find(v => v.id === bo.variant_id)?.variant_code || bo.variant_id}</p>
                    <p className="text-[10px] text-red-400">{bo.order_reference} • {bo.quantity} units</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-red-600">
                      {Math.floor((Date.now() - new Date(bo.created_at).getTime()) / (1000 * 60 * 60 * 24))}d waiting
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Supplier Performance (Mini) */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Supplier Performance
            </h3>
            <div className="space-y-4">
              {suppliers.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                      {s.name.charAt(0)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSupplierClick(s.id)}
                      className="text-sm font-bold text-gray-700 hover:text-indigo-600 hover:underline"
                    >
                      {s.name}
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-600">94% On-time</p>
                    <p className="text-[10px] text-gray-400">0.8% QC Rejection</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSupplier(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Supplier</p>
                  <h3 className="text-2xl font-bold">{selectedSupplier.name}</h3>
                  <p className="text-sm text-gray-500">{selectedSupplier.supplier_code || 'No Supplier ID'}</p>
                </div>
                <button onClick={() => setSelectedSupplier(null)} className="text-gray-400 hover:text-gray-600">
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

