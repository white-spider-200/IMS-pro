import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  DollarSign, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Package,
  Activity,
  ChevronRight,
  Warehouse as WarehouseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  Warehouse, 
  ProductVariant, 
  InventoryBalance, 
  Reservation, 
  StockMovement,
  Backorder
} from '../types';
import { seedBigData } from '../lib/seed';
import { Plus } from 'lucide-react';

export default function AdminDashboard() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [loading, setLoading] = useState(true);

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
      toast.error('Failed to sync admin data');
    };

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    }, handleError);

    const unsubVariants = onSnapshot(collection(db, 'product_variants'), (s) => {
      setVariants(s.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant)));
    }, handleError);

    const unsubBalances = onSnapshot(collection(db, 'inventory_balances'), (s) => {
      setBalances(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalance)));
    }, handleError);

    const unsubReservations = onSnapshot(collection(db, 'reservations'), (s) => {
      setReservations(s.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
    }, handleError);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const unsubMovements = onSnapshot(query(collection(db, 'stock_movements'), where('timestamp', '>=', ninetyDaysAgo.toISOString())), (s) => {
      setMovements(s.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
    }, handleError);

    const unsubBackorders = onSnapshot(collection(db, 'backorders'), (s) => {
      setBackorders(s.docs.map(d => ({ id: d.id, ...d.data() } as Backorder)));
      setLoading(false);
    }, handleError);

    return () => {
      unsubWarehouses();
      unsubVariants();
      unsubBalances();
      unsubReservations();
      unsubMovements();
      unsubBackorders();
    };
  }, []);

  // 1. Total Inventory Value
  const totalValue = useMemo(() => {
    return balances.reduce((acc, b) => {
      const v = variants.find(v => v.id === b.variant_id);
      const cost = v?.unit_cost || 0;
      return {
        total: acc.total + (b.available_quantity + b.reserved_quantity + b.blocked_quantity) * cost,
        available: acc.available + b.available_quantity * cost,
        reserved: acc.reserved + b.reserved_quantity * cost,
        blocked: acc.blocked + b.blocked_quantity * cost,
      };
    }, { total: 0, available: 0, reserved: 0, blocked: 0 });
  }, [balances, variants]);

  // 2. Stock Value by Warehouse
  const valueByWarehouse = useMemo(() => {
    return warehouses.map(w => {
      const wBalances = balances.filter(b => b.warehouse_id === w.id);
      let available = 0, reserved = 0, blocked = 0;
      wBalances.forEach(b => {
        const v = variants.find(v => v.id === b.variant_id);
        const cost = v?.unit_cost || 0;
        available += b.available_quantity * cost;
        reserved += b.reserved_quantity * cost;
        blocked += b.blocked_quantity * cost;
      });
      return { name: w.name, available, reserved, blocked };
    });
  }, [warehouses, balances, variants]);

  // 4. Order & Fulfillment Summary (Last 7 Days)
  const fulfillmentStats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRes = reservations.filter(r => new Date(r.created_at) >= sevenDaysAgo);
    const recentBO = backorders.filter(b => new Date(b.created_at) >= sevenDaysAgo);
    
    const totalOrders = recentRes.length + recentBO.length;
    const fullyReserved = recentRes.filter(r => r.status === 'committed').length;
    const failed = recentBO.length;
    const partial = totalOrders - fullyReserved - failed;

    return {
      total: totalOrders,
      fullyReserved: totalOrders > 0 ? Math.round((fullyReserved / totalOrders) * 100) : 0,
      partial: totalOrders > 0 ? Math.round((partial / totalOrders) * 100) : 0,
      failed: totalOrders > 0 ? Math.round((failed / totalOrders) * 100) : 0,
      backorderedLines: recentBO.length
    };
  }, [reservations, backorders]);

  // 5. Top 10 Fast-Moving SKUs
  const fastMoving = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentIssues = movements.filter(m => m.movement_type === 'issue' && new Date(m.timestamp) >= thirtyDaysAgo);
    
    const variantStats = variants.map(v => {
      const vIssues = recentIssues.filter(m => m.variant_id === v.id);
      const totalIssued = vIssues.reduce((acc, m) => acc + m.quantity, 0);
      const currentStock = balances.filter(b => b.variant_id === v.id).reduce((acc, b) => acc + b.available_quantity, 0);
      const avgDaily = totalIssued / 30;
      const daysOfCover = avgDaily > 0 ? Math.round(currentStock / avgDaily) : Infinity;

      return { variant: v, totalIssued, currentStock, daysOfCover };
    }).sort((a, b) => b.totalIssued - a.totalIssued).slice(0, 10);

    return variantStats;
  }, [variants, movements, balances]);

  // 6. Top 10 Slow-Moving / Dead Stock
  const slowMoving = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return variants.map(v => {
      const vMovements = movements.filter(m => m.variant_id === v.id && new Date(m.timestamp) >= ninetyDaysAgo);
      const currentStock = balances.filter(b => b.variant_id === v.id).reduce((acc, b) => acc + b.available_quantity, 0);
      return { variant: v, movementCount: vMovements.length, currentStock };
    }).filter(s => s.movementCount === 0 && s.currentStock > 0)
      .sort((a, b) => b.currentStock - a.currentStock)
      .slice(0, 10);
  }, [variants, movements, balances]);

  // 7. Warehouse Stock Levels
  const warehouseStock = useMemo(() => {
    return warehouses.map(w => {
      const totalUnits = balances.filter(b => b.warehouse_id === w.id).reduce((acc, b) => acc + b.available_quantity + b.reserved_quantity + b.blocked_quantity, 0);
      return { name: w.name, totalUnits };
    });
  }, [warehouses, balances]);

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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Admin Dashboard...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Overview</h1>
          <p className="text-gray-500 text-sm">Total inventory value and system-wide performance metrics. Last updated: {formatDateTime(new Date())}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBigSeed}
            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-100 transition-all text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Big Seed
          </button>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm font-bold">System Online</span>
          </div>
        </div>
      </div>

      {/* 1. Total Inventory Value */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-black text-white rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Value</span>
          </div>
          <div>
            <p className="text-3xl font-black">${totalValue.total.toLocaleString()}</p>
            <p className="text-xs text-white/60">Across {warehouses.length} warehouses</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</p>
          <p className="text-2xl font-black text-gray-800">${totalValue.available.toLocaleString()}</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${(totalValue.available / totalValue.total) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reserved</p>
          <p className="text-2xl font-black text-gray-800">${totalValue.reserved.toLocaleString()}</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${(totalValue.reserved / totalValue.total) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Blocked (QC)</p>
          <p className="text-2xl font-black text-gray-800">${totalValue.blocked.toLocaleString()}</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: `${(totalValue.blocked / totalValue.total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Stock Value by Warehouse */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-indigo-500" />
            Stock Value by Warehouse
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueByWarehouse} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="available" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="reserved" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="blocked" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Order & Fulfillment Summary */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Fulfillment (Last 7 Days)
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fully Reserved', value: fulfillmentStats.fullyReserved },
                    { name: 'Partial', value: fulfillmentStats.partial },
                    { name: 'Failed', value: fulfillmentStats.failed },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#22C55E" />
                  <Cell fill="#3B82F6" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Orders Received</span>
              <span className="font-bold">{fulfillmentStats.total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Backordered Lines</span>
              <span className="font-bold text-red-500">{fulfillmentStats.backorderedLines}</span>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                <span>Success Rate</span>
                <span className="text-green-500">{fulfillmentStats.fullyReserved}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 5. Top 10 Fast-Moving SKUs */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Fast-Moving SKUs
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last 30 Days</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Variant</th>
                  <th className="px-6 py-4">Issued</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Cover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fastMoving.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{item.variant.variant_code}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-600">{item.totalIssued}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-600">{item.currentStock}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-lg",
                        item.daysOfCover < 7 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                      )}>
                        {item.daysOfCover === Infinity ? '∞' : `${item.daysOfCover}d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Top 10 Slow-Moving / Dead Stock */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Slow-Moving / Dead Stock
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">90 Days Inactive</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Variant</th>
                  <th className="px-6 py-4">Stock Qty</th>
                  <th className="px-6 py-4">Estimated Value</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slowMoving.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No dead stock identified</td>
                  </tr>
                ) : slowMoving.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{item.variant.variant_code}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-600">{item.currentStock}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-500">
                      ${(item.currentStock * (item.variant.unit_cost || 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[10px] font-bold text-indigo-600 hover:underline">Liquidate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. Warehouse Stock Levels */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Warehouse Stock Levels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {warehouseStock.map((u, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{u.name}</span>
                <span className="text-xs font-bold text-indigo-500">{u.totalUnits.toLocaleString()} Units</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full rounded-full bg-indigo-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                Total Units Stored
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Background Worker Health */}
      <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reservation Expiry:</span>
          <span className="text-[10px] font-black text-gray-800">Active (47s ago)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Backorder Worker:</span>
          <span className="text-[10px] font-black text-gray-800">Active (2m ago)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nightly Snapshot:</span>
          <span className="text-[10px] font-black text-gray-800">Success (6h ago)</span>
        </div>
      </div>
    </div>
  );
}
