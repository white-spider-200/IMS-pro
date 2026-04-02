import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import {
  BarChart3,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  Clock,
  Activity,
  ArrowRightLeft,
  ChevronRight,
  TrendingUp,
  Users,
  Package,
  Calendar,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  Warehouse,
  ProductVariant,
  InventoryBalance,
  Reservation,
  StockMovement,
  User
} from '../types';
import { seedBigData } from '../lib/seed';

const SHOW_LOW_STOCK_UI = false;

export default function ManagerDashboard() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');

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
      toast.error('Failed to sync manager data');
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const unsubMovements = onSnapshot(query(collection(db, 'stock_movements'), where('timestamp', '>=', thirtyDaysAgo.toISOString())), (s) => {
      setMovements(s.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
      setLoading(false);
    }, handleError);

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    }, handleError);

    return () => {
      unsubWarehouses();
      unsubVariants();
      unsubBalances();
      unsubReservations();
      unsubMovements();
      unsubUsers();
    };
  }, []);

  // 1. Warehouse Health Summary
  const warehouseStats = useMemo(() => {
    return warehouses.map(w => {
      const wBalances = balances.filter(b => b.warehouse_id === w.id);
      const wVariants = variants.length;
      const lowStockCount = wBalances.filter(b => {
        const v = variants.find(v => v.id === b.variant_id);
        return b.available_quantity < (v?.reorder_threshold || 10);
      }).length;

      const health = wVariants > 0 ? Math.round(((wVariants - lowStockCount) / wVariants) * 100) : 100;
      const activeRes = reservations.filter(r => r.warehouse_id === w.id && r.status === 'active').length;
      const pendingQC = movements.filter(m => m.warehouse_id === w.id && m.status === 'pending_qc').length;

      return {
        ...w,
        health,
        lowStockCount,
        activeRes,
        pendingQC,
        staffOnDuty: Math.floor(Math.random() * 5) + 2 // Mocked for now
      };
    });
  }, [warehouses, balances, variants, reservations, movements]);

  // 2. Low Stock Alert Panel (with Stockout Estimation)
  const lowStockAlerts = useMemo(() => {
    return balances.filter(b => {
      const v = variants.find(v => v.id === b.variant_id);
      return b.available_quantity < (v?.reorder_threshold || 10);
    }).map(b => {
      const v = variants.find(v => v.id === b.variant_id);
      const w = warehouses.find(w => w.id === b.warehouse_id);

      // Estimate daily movement
      const vMovements = movements.filter(m => m.variant_id === b.variant_id && m.warehouse_id === b.warehouse_id && m.movement_type === 'issue');
      const totalIssued = vMovements.reduce((acc, m) => acc + m.quantity, 0);
      const avgDaily = totalIssued / 30;
      const daysUntilStockout = avgDaily > 0 ? Math.round(b.available_quantity / avgDaily) : Infinity;

      return {
        balance: b,
        variant: v,
        warehouse: w,
        threshold: v?.reorder_threshold || 10,
        daysUntilStockout
      };
    }).sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }, [balances, variants, warehouses, movements]);

  // 3. Stock Movement Trend
  const chartData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    return days.map(date => {
      const dayMovements = movements.filter(m => m.timestamp.startsWith(date));
      return {
        date: date.slice(5), // MM-DD
        receipts: dayMovements.filter(m => m.movement_type === 'receipt').reduce((acc, m) => acc + m.quantity, 0),
        issues: dayMovements.filter(m => m.movement_type === 'issue').reduce((acc, m) => acc + m.quantity, 0),
        returns: dayMovements.filter(m => m.movement_type === 'return').reduce((acc, m) => acc + m.quantity, 0),
        adjustments: dayMovements.filter(m => m.movement_type === 'adjustment').reduce((acc, m) => acc + m.quantity, 0),
      };
    });
  }, [movements]);

  // 4. Reservation Overview
  const resOverview = useMemo(() => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    return {
      active: reservations.filter(r => r.status === 'active').length,
      expiringSoon: reservations.filter(r => r.status === 'active' && new Date(r.expiry_timestamp) < oneHourFromNow).length,
      expiredToday: reservations.filter(r => r.status === 'expired' && r.created_at.startsWith(todayStr)).length,
      committedToday: reservations.filter(r => r.status === 'committed' && r.created_at.startsWith(todayStr)).length,
      releasedToday: reservations.filter(r => r.status === 'expired' && r.created_at.startsWith(todayStr)).length, // Mocked release
    };
  }, [reservations]);

  // 5. Transfer Status
  const inTransitTransfers = useMemo(() => {
    return movements.filter(m => m.movement_type === 'transfer_in' && m.status === 'in_transit').map(m => {
      const hoursInTransit = Math.floor((Date.now() - new Date(m.timestamp).getTime()) / (1000 * 60 * 60));
      return { ...m, hoursInTransit };
    });
  }, [movements]);

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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Manager Dashboard...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manager Oversight</h1>
          <p className="text-gray-500 text-sm">Real-time health monitoring across all warehouses. Last updated: {new Date().toLocaleTimeString()}</p>
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
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold">Last 30 Days</span>
          </div>
        </div>
      </div>

      {/* 1. Warehouse Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {warehouseStats.map(w => (
          <div key={w.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <WarehouseIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">{w.name}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400 uppercase tracking-widest">Stock Health</span>
                  <span className={cn(w.health > 80 ? "text-green-500" : "text-orange-500")}>{w.health}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${w.health}%` }}
                    className={cn("h-full rounded-full", w.health > 80 ? "bg-green-500" : "bg-orange-500")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Reservations</p>
                  <p className="text-lg font-black text-gray-800">{w.activeRes}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Pending QC</p>
                  <p className="text-lg font-black text-blue-500">{w.pendingQC}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Staff Duty</p>
                  <p className="text-lg font-black text-green-500">{w.staffOnDuty}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Suppliers Summary Card for Manager */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-800">Suppliers</h3>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Partners</p>
            <p className="text-3xl font-black text-purple-600">
              {/* We need to fetch suppliers here or use a count from variants */}
              {Array.from(new Set(variants.map(v => v.supplier_id))).filter(Boolean).length}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-4 italic">Managing {variants.length} unique product variants</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3. Stock Movement Trend */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Stock Movement Trend
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Receipts</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Issues</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> Returns</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Adjustments</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="receipts" stroke="#22C55E" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="issues" stroke="#3B82F6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="returns" stroke="#F97316" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="adjustments" stroke="#EF4444" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Reservation Overview */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Reservation Overview
          </h3>
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">Active Reservations</span>
              <span className="text-xl font-black text-gray-800">{resOverview.active}</span>
            </div>
            <div className={cn("p-4 rounded-2xl flex items-center justify-between", resOverview.expiringSoon > 10 ? "bg-yellow-50 text-yellow-700" : "bg-gray-50")}>
              <span className="text-sm font-bold">Expiring in &lt; 1 hour</span>
              <span className="text-xl font-black">{resOverview.expiringSoon}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Expired</p>
                <p className="text-sm font-black">{resOverview.expiredToday}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Committed</p>
                <p className="text-sm font-black">{resOverview.committedToday}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Released</p>
                <p className="text-sm font-black">{resOverview.releasedToday}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-8 ${SHOW_LOW_STOCK_UI ? 'lg:grid-cols-2' : ''}`}>
        {SHOW_LOW_STOCK_UI && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Low Stock Alert Panel
              </h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Wide</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Warehouse</th>
                    <th className="px-6 py-4">Variant</th>
                    <th className="px-6 py-4">Qty / Threshold</th>
                    <th className="px-6 py-4">Days to Stockout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lowStockAlerts.slice(0, 5).map((alert, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-gray-600">{alert.warehouse?.name}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold">{alert.variant?.variant_code}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-red-500">{alert.balance.available_quantity}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-sm text-gray-400">{alert.threshold}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-xs font-bold px-2 py-1 rounded-lg",
                          alert.daysUntilStockout < 3 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {alert.daysUntilStockout === Infinity ? 'No movement' : `${alert.daysUntilStockout} days`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Transfer Status */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-500" />
              Transfer Status
            </h3>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">In-Transit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Variant</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Transit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inTransitTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">No transfers in transit</td>
                  </tr>
                ) : inTransitTransfers.map((t, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold">{variants.find(v => v.id === t.variant_id)?.variant_code}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm">{t.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-xs font-bold",
                        t.hoursInTransit > 24 ? "text-red-500" : "text-gray-600"
                      )}>
                        {t.hoursInTransit}h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Staff Activity Log */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            Staff Activity Log
          </h3>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Last 50 Actions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Variant</th>
                <th className="px-6 py-4">Qty</th>
                <th className="px-6 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements.slice(0, 10).map((m, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                        {m.user_id?.slice(0, 2) || 'SY'}
                      </div>
                      <span className="text-xs font-bold text-gray-600">{m.user_id || 'System'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      m.movement_type === 'receipt' ? "bg-green-100 text-green-600" :
                        m.movement_type === 'issue' ? "bg-blue-100 text-blue-600" :
                          "bg-gray-100 text-gray-600"
                    )}>
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold">
                    {variants.find(v => v.id === m.variant_id)?.variant_code}
                  </td>
                  <td className="px-6 py-4 font-bold text-sm">{m.quantity}</td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {formatDateTime(m.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
