import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowRightLeft, 
  Package, 
  AlertTriangle,
  Search,
  ChevronRight,
  History as HistoryIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

import { Warehouse, ProductVariant, InventoryBalance, Reservation, StockMovement } from '../../types';

interface WarehouseStaffDashboardProps {
  warehouseId: string;
}

export default function WarehouseStaffDashboard({ warehouseId }: WarehouseStaffDashboardProps) {
  const [tasks, setTasks] = useState<StockMovement[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [variants, setVariants] = useState<Record<string, ProductVariant>>({});
  const [loading, setLoading] = useState(true);

  const lowStock = useMemo(() => {
    return balances.filter(b => {
      const variant = variants[b.variant_id];
      const threshold = variant?.reorder_threshold || 10;
      return b.available_quantity <= threshold;
    });
  }, [balances, variants]);

  useEffect(() => {
    if (!warehouseId) return;

    setLoading(true);

    // 1. Fetch Variants for lookup
    const unsubVariants = onSnapshot(collection(db, 'product_variants'), (s) => {
      const vMap: Record<string, ProductVariant> = {};
      s.docs.forEach(d => vMap[d.id] = { id: d.id, ...d.data() } as ProductVariant);
      setVariants(vMap);
    });

    // 2. Tasks Queue (Pending Movements)
    const qTasks = query(
      collection(db, 'stock_movements'),
      where('warehouse_id', '==', warehouseId),
      where('status', 'in', ['pending_qc', 'pending_inspection', 'in_transit']),
      orderBy('timestamp', 'desc')
    );
    const unsubTasks = onSnapshot(qTasks, (s) => {
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
    });

    // 3. Today's Movements
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qMovements = query(
      collection(db, 'stock_movements'),
      where('warehouse_id', '==', warehouseId),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );
    const unsubMovements = onSnapshot(qMovements, (s) => {
      setMovements(s.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
    });

    // 4. Active Reservations (Expiring Soon)
    const qReservations = query(
      collection(db, 'reservations'),
      where('warehouse_id', '==', warehouseId),
      where('status', '==', 'active'),
      orderBy('expiry_timestamp', 'asc'),
      limit(10)
    );
    const unsubReservations = onSnapshot(qReservations, (s) => {
      setReservations(s.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
    });

    // 5. Balances
    const qBalances = query(
      collection(db, 'inventory_balances'),
      where('warehouse_id', '==', warehouseId)
    );
    const unsubBalances = onSnapshot(qBalances, (s) => {
      setBalances(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryBalance)));
      setLoading(false);
    });

    return () => {
      unsubVariants();
      unsubTasks();
      unsubMovements();
      unsubReservations();
      unsubBalances();
    };
  }, [warehouseId]);

  const getTimeRemaining = (expiry: string) => {
    const diff = new Date(expiry).getTime() - new Date().getTime();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m remaining`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m remaining`;
  };

  const stats = {
    received: movements.filter(m => m.movement_type === 'receipt').reduce((acc, m) => acc + m.quantity, 0),
    issued: movements.filter(m => m.movement_type === 'issue').reduce((acc, m) => acc + m.quantity, 0),
    transferred: movements.filter(m => m.movement_type === 'transfer_out').reduce((acc, m) => acc + m.quantity, 0),
    returned: movements.filter(m => m.movement_type === 'return').reduce((acc, m) => acc + m.quantity, 0),
    adjustments: movements.filter(m => m.movement_type === 'adjustment').reduce((acc, m) => acc + m.quantity, 0),
  };

  const taskGroups = {
    qc: tasks.filter(t => t.status === 'pending_qc').length,
    inspection: tasks.filter(t => t.status === 'pending_inspection').length,
    transit: tasks.filter(t => t.status === 'in_transit').length,
    expiring: reservations.filter(r => {
      const diff = new Date(r.expiry_timestamp).getTime() - new Date().getTime();
      return diff > 0 && diff < 2 * 60 * 60 * 1000; // 2 hours
    }).length
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Warehouse Operations...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Tasks Queue */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Tasks Queue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TaskCard 
            label="QC Approval" 
            count={taskGroups.qc} 
            type="URGENT" 
            icon={<AlertCircle className="w-4 h-4" />}
            color="red"
          />
          <TaskCard 
            label="Returns Inspection" 
            count={taskGroups.inspection} 
            type="ACTION" 
            icon={<Clock className="w-4 h-4" />}
            color="orange"
          />
          <TaskCard 
            label="Transfers In-Transit" 
            count={taskGroups.transit} 
            type="PENDING" 
            icon={<ArrowRightLeft className="w-4 h-4" />}
            color="blue"
          />
          <TaskCard 
            label="Expiring Reservations" 
            count={taskGroups.expiring} 
            type="INFO" 
            icon={<Clock className="w-4 h-4" />}
            color="indigo"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Today's Movement Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-gray-400" />
              Today's Movement
            </h3>
            <div className="space-y-4">
              <MovementStat label="Received today" value={stats.received} icon={<ArrowDownLeft className="text-green-500" />} />
              <MovementStat label="Issued today" value={stats.issued} icon={<ArrowUpRight className="text-blue-500" />} />
              <MovementStat label="Transferred out" value={stats.transferred} icon={<ArrowRightLeft className="text-purple-500" />} />
              <MovementStat label="Returned today" value={stats.returned} icon={<ArrowDownLeft className="text-orange-500" />} />
              <MovementStat 
                label="Adjustments" 
                value={stats.adjustments} 
                icon={<AlertTriangle className={cn(stats.adjustments > 0 ? "text-red-500" : "text-gray-300")} />} 
                highlight={stats.adjustments > 0}
              />
            </div>
          </div>

          {/* 4. Low Stock in This Warehouse */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Low Stock
            </h3>
            {lowStock.length === 0 ? (
              <div className="py-8 text-center text-green-600 font-medium flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8" />
                All stock levels healthy ✓
              </div>
            ) : (
              <div className="space-y-4">
                {lowStock.map(item => {
                  const variant = variants[item.variant_id];
                  const threshold = variant?.reorder_threshold || 10;
                  const percent = Math.round((item.available_quantity / threshold) * 100);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{variant?.variant_code || item.variant_id}</p>
                          <p className="text-xs text-gray-500">{item.available_quantity} units available</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-xs font-bold px-2 py-1 rounded-lg",
                          percent < 50 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {percent}% remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Active Reservations — Expiring Soon */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Active Reservations
              </h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expiring Soon</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest">
                    <th className="px-6 py-4 font-bold">Variant Name</th>
                    <th className="px-6 py-4 font-bold">Qty</th>
                    <th className="px-6 py-4 font-bold">Order Ref</th>
                    <th className="px-6 py-4 font-bold">Time Remaining</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No active reservations</td>
                    </tr>
                  ) : reservations.map(res => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                          <p className="font-bold text-sm">{variants[res.variant_id]?.variant_code || res.variant_id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium">{res.quantity}</span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-600">{res.order_reference}</code>
                      </td>
                      <td className="px-6 py-4">
                        <p className={cn(
                          "text-xs font-bold",
                          getTimeRemaining(res.expiry_timestamp).includes('m remaining') ? "text-red-500" : "text-gray-500"
                        )}>
                          {getTimeRemaining(res.expiry_timestamp)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-white rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ label, count, type, icon, color }: any) {
  const colors: any = {
    red: "bg-red-50 text-red-600 border-red-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  return (
    <div className={cn("p-4 rounded-3xl border shadow-sm transition-all hover:shadow-md", colors[color])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">{type}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black">{count}</span>
        <span className="text-xs font-bold opacity-80">{label}</span>
      </div>
    </div>
  );
}

function MovementStat({ label, value, icon, highlight }: any) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-2xl transition-all",
      highlight ? "bg-red-50 border border-red-100" : "bg-gray-50 border border-transparent"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-bold text-gray-600">{label}</span>
      </div>
      <span className={cn("text-lg font-black", highlight ? "text-red-600" : "text-gray-900")}>
        {value}
      </span>
    </div>
  );
}
