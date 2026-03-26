import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { History as HistoryIcon, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, AlertCircle, Package, X, Warehouse as WarehouseIcon, Info, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function StockMovementHistory() {
  const [movements, setMovements] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  
  const [selectedItemDetails, setSelectedItemDetails] = useState<any>(null);
  const [isItemDetailsModalOpen, setIsItemDetailsModalOpen] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  useEffect(() => {
    const handleError = (error: any) => {
      console.error('Firestore snapshot error:', error);
      toast.error('Failed to sync movement history');
      setLoading(false);
    };

    const q = query(collection(db, 'stock_movements'), orderBy('timestamp', 'desc'), limit(100));
    const unsubMovements = onSnapshot(q, (s) => {
      setMovements(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, handleError);

    const unsubVariants = onSnapshot(collection(db, 'product_variants'), (s) => {
      setVariants(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, handleError);

    const unsubProducts = onSnapshot(collection(db, 'products'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, handleError);

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, handleError);

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (s) => {
      setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, handleError);

    const unsubBalances = onSnapshot(collection(db, 'inventory_balances'), (s) => {
      setBalances(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, handleError);

    return () => { 
      unsubMovements(); 
      unsubVariants(); 
      unsubProducts();
      unsubWarehouses(); 
      unsubSuppliers();
      unsubBalances();
    };
  }, []);

  const getVariantName = (id: string) => {
    const v = variants.find(v => v.id === id);
    if (!v) return id;
    const p = products.find(p => p.id === v.product_id);
    return p ? `${p.name} - ${v.variant_code}` : v.variant_code;
  };

  const getWarehouseName = (id: string) => {
    return warehouses.find(w => w.id === id)?.name || id;
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

  const handleMovementClick = (movement: any) => {
    setSelectedMovement(movement);
    setIsMovementModalOpen(true);
  };

  const handleWarehouseClick = (variantId: string, warehouseId: string) => {
    const balance = balances.find(b => b.variant_id === variantId && b.warehouse_id === warehouseId);
    const history = movements
      .filter(m => m.variant_id === variantId && m.warehouse_id === warehouseId)
      .sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });

    if (balance) {
      setSelectedItemDetails({
        balance,
        history
      });
      setIsItemDetailsModalOpen(true);
    } else {
      toast.info('No inventory balance found for this item in this warehouse.');
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'receipt': return <ArrowDownLeft className="text-green-500" />;
      case 'issue': return <ArrowUpRight className="text-red-500" />;
      case 'transfer_out':
      case 'transfer_in': return <ArrowRightLeft className="text-blue-500" />;
      default: return <AlertCircle className="text-gray-500" />;
    }
  };

  const filteredMovements = movements.filter(m => {
    const timestamp = new Date(m.timestamp).getTime();
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() : Infinity;
    return timestamp >= from && timestamp <= to;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Movements</h1>
          <p className="text-gray-500 text-sm">Full audit trail of all inventory changes.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-col px-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">From</label>
            <input 
              type="datetime-local" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs font-bold outline-none bg-transparent"
            />
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="flex flex-col px-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">To</label>
            <input 
              type="datetime-local" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs font-bold outline-none bg-transparent"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Variant</th>
                <th className="px-6 py-4 font-semibold">Warehouse</th>
                <th className="px-6 py-4 font-semibold">Quantity</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading...</td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">No movements found for the selected range.</td>
                </tr>
              ) : filteredMovements.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleMovementClick(item)}
                      className="text-xs font-mono text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer"
                    >
                      {item.id.slice(0, 8)}...
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getMovementIcon(item.movement_type)}
                      <span className="text-sm font-semibold capitalize">{item.movement_type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-700 font-medium">{getVariantName(item.variant_id)}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                            {(() => {
                              const v = variants.find(v => v.id === item.variant_id);
                              const p = v ? products.find(p => p.id === v.product_id) : null;
                              const s = p ? suppliers.find(s => s.id === p.supplier_id) : null;
                              return s?.name || 'N/A';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleWarehouseClick(item.variant_id, item.warehouse_id)}
                      className="text-sm text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer"
                    >
                      {getWarehouseName(item.warehouse_id)}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-sm font-bold",
                      ['issue', 'transfer_out'].includes(item.movement_type) ? "text-red-500" : "text-green-600"
                    )}>
                      {['issue', 'transfer_out'].includes(item.movement_type) ? '-' : '+'}{item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">{formatDateTime(item.timestamp)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {/* Movement Details Modal */}
        {isMovementModalOpen && selectedMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMovementModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Info className="w-8 h-8 text-blue-600" />
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
                  <p className="text-lg font-bold capitalize">{selectedMovement.movement_type.replace('_', ' ')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Quantity</label>
                  <p className={cn(
                    "text-lg font-bold",
                    ['issue', 'transfer_out'].includes(selectedMovement.movement_type) ? "text-red-600" : "text-green-600"
                  )}>
                    {['issue', 'transfer_out'].includes(selectedMovement.movement_type) ? '-' : '+'}{selectedMovement.quantity}
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
                <p className="text-lg font-bold">{getVariantName(selectedMovement.variant_id)}</p>
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

        {/* Inventory Item Details Modal */}
        {isItemDetailsModalOpen && selectedItemDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsItemDetailsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <HistoryIcon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Inventory Item Details</h3>
                    <p className="text-gray-500 text-sm">#{selectedItemDetails.balance.id.toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setIsItemDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Available Quantity</label>
                  <p className="text-2xl font-black text-gray-900">{selectedItemDetails.balance.available_quantity}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Reserved Quantity</label>
                  <p className="text-2xl font-black text-gray-900">{selectedItemDetails.balance.reserved_quantity}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Warehouse</label>
                  <p className="text-sm font-bold text-gray-800">{getWarehouseName(selectedItemDetails.balance.warehouse_id)}</p>
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
                      {selectedItemDetails.history
                        .filter((m: any) => {
                          const timestamp = m.timestamp?.toDate ? m.timestamp.toDate().getTime() : new Date(m.timestamp).getTime();
                          const from = historyDateFrom ? new Date(historyDateFrom).getTime() : 0;
                          const to = historyDateTo ? new Date(historyDateTo).getTime() : Infinity;
                          return timestamp >= from && timestamp <= to;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No movement history found for the selected range.</td>
                        </tr>
                      ) : selectedItemDetails.history
                        .filter((m: any) => {
                          const timestamp = m.timestamp?.toDate ? m.timestamp.toDate().getTime() : new Date(m.timestamp).getTime();
                          const from = historyDateFrom ? new Date(historyDateFrom).getTime() : 0;
                          const to = historyDateTo ? new Date(historyDateTo).getTime() : Infinity;
                          return timestamp >= from && timestamp <= to;
                        })
                        .map((m: any, idx: number) => (
                        <tr key={idx} className="text-sm hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                              ['issue', 'transfer_out'].includes(m.movement_type) ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                            )}>
                              {m.movement_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${['issue', 'transfer_out'].includes(m.movement_type) ? 'text-red-600' : 'text-green-600'}`}>
                            {['issue', 'transfer_out'].includes(m.movement_type) ? '-' : '+'}{m.quantity}
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
                <button onClick={() => setIsItemDetailsModalOpen(false)} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">
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
