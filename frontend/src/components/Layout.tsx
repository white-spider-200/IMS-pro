import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  BarChart3,
  Warehouse as WarehouseIcon,
  Truck,
  Tag,
  Layers,
  Package,
  Boxes,
  History as HistoryIcon,
  LogOut,
  Menu,
  X,
  User,
  Users,
  ShieldAlert,
  ShoppingCart,
  RotateCcw,
  Wallet,
  ReceiptText,
  LineChart,
  Calculator,
  Circle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { cn } from '../lib/utils';
import { enableDemoMode, useDemoMode, disableDemoMode } from '../demo/demoMode';
import * as demoData from '../demo/demoData';
import { getDemoDatabase, subscribeDemoDatabase } from '../demo/demoDatabase';
import { getDemoProfile, subscribeDemoProfile } from '../demo/demoProfile';
import { isFirestoreSyncPaused, subscribeFirestoreSyncPause } from '../lib/syncPause';
import { mergeClientsWithFinancials } from '../lib/clientFinancials';
import { api } from '../lib/api';
import { login as localLogin, logout as localLogout, fetchCurrentUser, getToken } from '../lib/localAuth';
import { useSSE } from '../lib/useSSE';

function sortByNewest(items: any[], dateField = 'created_at') {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left?.[dateField] || left?.timestamp || 0).getTime();
    const rightTime = new Date(right?.[dateField] || right?.timestamp || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function Layout() {
  const isDemoMode = useDemoMode();
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Global Data
  const [balances, setBalances] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [revenueInvoices, setRevenueInvoices] = useState<any[]>([]);
  const [transferInvoices, setTransferInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [returnInvoices, setReturnInvoices] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [warehouseExpenses, setWarehouseExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoProfileVersion, setDemoProfileVersion] = useState(0);
  const [isSyncPaused, setIsSyncPaused] = useState(isFirestoreSyncPaused());

  // Modal state
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const isInventoryRoute = location.pathname === '/' || location.pathname.startsWith('/inventory');
  const isOperationsRoute = ['/buy', '/sell', '/return', '/expenses', '/cogs', '/net-profit'].some((p) => location.pathname.startsWith(p));
  const isAccountingRoute = location.pathname.startsWith('/accounting');
  const [isInventoryMenuOpen, setIsInventoryMenuOpen] = useState(isInventoryRoute);
  const [isOperationsMenuOpen, setIsOperationsMenuOpen] = useState(isOperationsRoute);
  const [isAccountingMenuOpen, setIsAccountingMenuOpen] = useState(isAccountingRoute);

  const demoProfile = getDemoProfile();
  const currentUserProfile = users.find((e) => e.id === user?.id) || null;
  const effectiveUser = user
    ? {
      ...user,
      ...currentUserProfile,
      displayName: currentUserProfile?.displayName || user.displayName,
      email: currentUserProfile?.email || user.email,
    }
    : null;

  const effectiveClients = useMemo(
    () => mergeClientsWithFinancials(clients, revenueInvoices, purchaseInvoices, clientPayments),
    [clientPayments, clients, purchaseInvoices, revenueInvoices]
  );

  // ----- Load all data from local API -----
  const fetchAllData = useCallback(async () => {
    if (isDemoMode || !getToken()) return;
    try {
      const [
        bal, variantData, prodData, whData, movData, revInv, trfInv, purInv, retInv,
        cpData, expData, trfData, brandData, catData, supData, cliData, usrData
      ] = await Promise.all([
        api.collection.getAll('inventory_balances'),
        api.collection.getAll('product_variants'),
        api.collection.getAll('products'),
        api.collection.getAll('warehouses'),
        api.collection.getAll('stock_movements'),
        api.collection.getAll('revenue_invoices'),
        api.collection.getAll('transfer_invoices'),
        api.collection.getAll('purchase_invoices'),
        api.collection.getAll('return_invoices'),
        api.collection.getAll('client_payments'),
        api.collection.getAll('warehouse_expenses'),
        api.collection.getAll('transfers'),
        api.collection.getAll('brands'),
        api.collection.getAll('categories'),
        api.collection.getAll('suppliers'),
        api.collection.getAll('clients'),
        api.collection.getAll('users'),
      ]);
      setBalances(bal);
      setVariants(variantData);
      setProducts(prodData);
      setWarehouses(whData);
      setMovements(sortByNewest(movData, 'timestamp'));
      setRevenueInvoices(sortByNewest(revInv));
      setTransferInvoices(sortByNewest(trfInv));
      setPurchaseInvoices(sortByNewest(purInv));
      setReturnInvoices(sortByNewest(retInv));
      setClientPayments(sortByNewest(cpData));
      setWarehouseExpenses(sortByNewest(expData));
      setTransfers(sortByNewest(trfData));
      setBrands(brandData);
      setCategories(catData);
      setSuppliers(supData);
      setClients(cliData);
      setUsers(usrData);
      setLoading(false);
    } catch (e) {
      console.error('Failed to load data', e);
      setLoading(false);
    }
  }, [isDemoMode]);

  // SSE real-time updates: refetch the changed collection
  const handleSSEMessage = useCallback((collection: string, _event: string, data: any) => {
    const collectionSetters: Record<string, (v: any) => void> = {
      inventory_balances: setBalances,
      product_variants: setVariants,
      products: setProducts,
      warehouses: setWarehouses,
      brands: setBrands,
      categories: setCategories,
      suppliers: setSuppliers,
      clients: setClients,
      users: setUsers,
    };

    const sortedSetters: Record<string, (v: any) => void> = {
      stock_movements: (d) => setMovements(sortByNewest(d, 'timestamp')),
      revenue_invoices: (d) => setRevenueInvoices(sortByNewest(d)),
      transfer_invoices: (d) => setTransferInvoices(sortByNewest(d)),
      purchase_invoices: (d) => setPurchaseInvoices(sortByNewest(d)),
      return_invoices: (d) => setReturnInvoices(sortByNewest(d)),
      client_payments: (d) => setClientPayments(sortByNewest(d)),
      warehouse_expenses: (d) => setWarehouseExpenses(sortByNewest(d)),
      transfers: (d) => setTransfers(sortByNewest(d)),
    };

    if (_event === 'snapshot') {
      if (collectionSetters[collection]) collectionSetters[collection](data);
      if (sortedSetters[collection]) sortedSetters[collection](data);
    } else {
      // For single-doc events, just re-fetch all data (simple approach)
      fetchAllData();
    }
  }, [fetchAllData]);

  useSSE(handleSSEMessage, !!user && !isDemoMode);

  useEffect(() => {
    if (!isDemoMode) return;
    return subscribeDemoProfile(() => setDemoProfileVersion((n) => n + 1));
  }, [isDemoMode]);

  useEffect(() => subscribeFirestoreSyncPause(() => setIsSyncPaused(isFirestoreSyncPaused())), []);

  useEffect(() => { if (isInventoryRoute) setIsInventoryMenuOpen(true); }, [isInventoryRoute]);
  useEffect(() => { if (isOperationsRoute) setIsOperationsMenuOpen(true); }, [isOperationsRoute]);
  useEffect(() => { if (isAccountingRoute) setIsAccountingMenuOpen(true); }, [isAccountingRoute]);

  // Auth initialization
  useEffect(() => {
    if (isDemoMode) {
      setUser({
        id: 'demo-user-id',
        email: demoProfile.email || demoData.demoUser.email,
        displayName: demoProfile.displayName || demoData.demoUser.name,
        role: 'admin',
      });
      return;
    }

    fetchCurrentUser().then((u) => {
      setUser(u);
      if (u) fetchAllData();
      else setLoading(false);
    });
  }, [isDemoMode, fetchAllData, demoProfileVersion]);

  // Demo mode data
  useEffect(() => {
    if (!isDemoMode) return;
    const syncFromDemoDb = () => {
      const demoDb = getDemoDatabase();
      setBalances(demoDb.inventory_balances);
      setVariants(demoDb.product_variants);
      setProducts(demoDb.products);
      setWarehouses(demoDb.warehouses);
      setMovements(sortByNewest(demoDb.stock_movements, 'timestamp'));
      setRevenueInvoices(sortByNewest(demoDb.revenue_invoices));
      setTransferInvoices(sortByNewest(demoDb.transfer_invoices));
      setPurchaseInvoices(sortByNewest(demoDb.purchase_invoices));
      setReturnInvoices(sortByNewest(demoDb.return_invoices));
      setClientPayments(sortByNewest(demoDb.client_payments));
      setWarehouseExpenses(sortByNewest(demoDb.warehouse_expenses));
      setTransfers(sortByNewest(demoDb.transfers));
      setBrands(demoDb.brands);
      setCategories(demoDb.categories);
      setSuppliers(demoDb.suppliers);
      setClients(demoDb.clients);
      setUsers(demoDb.users);
      setLoading(false);
    };
    syncFromDemoDb();
    return subscribeDemoDatabase(syncFromDemoDb);
  }, [isDemoMode]);

  // Handlers
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
  const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || id;
  const formatDateTime = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch { return 'Invalid Date'; }
  };

  const handleWarehouseClick = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (!warehouse) return;
    const manager = users.find(u => u.id === warehouse.manager_id);
    setSelectedWarehouse({
      ...warehouse,
      manager_name: manager?.displayName || warehouse.manual_manager_name || 'No Manager Assigned',
      manager_email: manager?.email || warehouse.manual_manager_email || '',
      manager_phone: manager?.phone || warehouse.manual_manager_phone || '',
      is_system_manager: !!manager,
      balances: balances.filter(b => b.warehouse_id === warehouseId),
      movements: movements.filter(m => m.warehouse_id === warehouseId),
    });
    setIsWarehouseModalOpen(true);
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
      brand_name: brand?.name,
      category_name: category?.name,
      supplier_name: supplier?.name,
      distribution: balances.filter(b => b.variant_id === variantId),
    });
    setIsVariantModalOpen(true);
  };

  const handleProductClick = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;
    const product = products.find(p => p.id === variant.product_id);
    const brand = brands.find(b => b.id === product?.brand_id);
    const category = categories.find(c => c.id === product?.category_id);
    const supplier = suppliers.find(s => s.id === product?.supplier_id);
    setSelectedProduct({
      ...product,
      brand_name: brand?.name || 'Unknown Brand',
      category_name: category?.name || 'Unknown Category',
      supplier_name: supplier?.name || 'Unknown Supplier',
      variant,
      distribution: balances.filter(b => b.variant_id === variantId),
    });
    setIsProductModalOpen(true);
  };

  const handleMovementClick = (movement: any) => { setSelectedMovement(movement); setIsMovementModalOpen(true); };
  const handleHistoryClick = (item: any) => {
    const history = movements
      .filter(m => m.variant_id === item.variant_id && m.warehouse_id === item.warehouse_id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSelectedHistory({ balance: item, history });
    setIsHistoryModalOpen(true);
  };
  const handleInvoiceClick = (variantId: string, warehouseId: string) => {
    const invoice = revenueInvoices
      .filter(inv => inv.warehouse_id === warehouseId && (inv.items || []).some((item: any) => item.variant_id === variantId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (invoice) { setSelectedInvoice(invoice); setIsInvoiceModalOpen(true); }
    else toast.info('No revenue invoice found for this item in this warehouse.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { toast.error('Please enter email and password'); return; }
    setLoginLoading(true);
    try {
      const u = await localLogin(loginEmail, loginPassword);
      setUser(u);
      toast.success(`Welcome, ${u.displayName || u.email}!`);
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) { disableDemoMode(); toast.success('Exited Demo Mode'); navigate('/'); return; }
    await localLogout();
    setUser(null);
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleDemoMode = () => { enableDemoMode(); toast.success('Demo mode enabled'); };

  const inventoryChildren = [
    { name: 'Warehouses', icon: WarehouseIcon, path: '/inventory/warehouses' },
    { name: 'Suppliers', icon: Truck, path: '/inventory/suppliers' },
    { name: 'Clients', icon: Users, path: '/inventory/clients' },
    { name: 'Brands', icon: Tag, path: '/inventory/brands' },
    { name: 'Categories', icon: Layers, path: '/inventory/categories' },
    { name: 'Products', icon: Package, path: '/inventory/products' },
    { name: 'Variants', icon: Tag, path: '/inventory/variants' },
  ];
  const operationsChildren = [
    { name: 'Buy', icon: Truck, path: '/buy' },
    { name: 'Sell', icon: ShoppingCart, path: '/sell' },
    { name: 'Return', icon: RotateCcw, path: '/return' },
    { name: 'Expenses', icon: Wallet, path: '/expenses' },
    { name: 'COGS', icon: LineChart, path: '/cogs' },
    { name: 'Net Profit', icon: BarChart3, path: '/net-profit' },
  ];
  const accountingChildren = [
    { name: 'Profit & Loss', icon: Circle, path: '/accounting/profit-loss' },
    { name: 'Aged Receivable', icon: Circle, path: '/accounting/aged-receivable' },
    { name: 'Aged Payable', icon: Circle, path: '/accounting/aged-payable' },
    { name: 'Cash Flow', icon: Circle, path: '/accounting/cash-flow' },
    { name: 'Tax Report', icon: Circle, path: '/accounting/tax-report' },
  ];
  const navItems = [
    { name: 'Inventory', icon: Boxes, path: '/', children: inventoryChildren },
    { name: 'Operations', icon: ReceiptText, path: '/buy', children: operationsChildren },
    { name: 'Accounting', icon: Calculator, path: '/accounting', children: accountingChildren },
  ];

  const currentPageTitle = inventoryChildren.find((i) => i.path === location.pathname)?.name
    || operationsChildren.find((i) => i.path === location.pathname)?.name
    || accountingChildren.find((i) => i.path === location.pathname)?.name
    || navItems.find((i) => i.path === location.pathname)?.name
    || 'Inventory';

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-surface max-w-md w-full p-8"
        >
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black">
              <Boxes className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">IMS Pro</h1>
            <p className="mt-1 text-sm text-gray-500">Multi-Warehouse Inventory Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@ims.local"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="app-button-primary w-full py-3.5 disabled:opacity-50"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">or</span></div>
            </div>
            <button onClick={handleDemoMode} className="app-button-secondary w-full py-3">
              Continue in Demo Mode
            </button>
            <p className="mt-3 text-xs text-gray-400">Default: admin@ims.local / admin123</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const NavContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <nav className="flex-1 px-4 space-y-2 mt-4">
      {navItems.map((item) => {
        if (item.children) {
          const isInventoryGroup = item.name === 'Inventory';
          const isOperationsGroup = item.name === 'Operations';
          const isGroupRoute = isInventoryGroup ? isInventoryRoute : isOperationsGroup ? isOperationsRoute : isAccountingRoute;
          const isGroupOpen = isInventoryGroup ? isInventoryMenuOpen : isOperationsGroup ? isOperationsMenuOpen : isAccountingMenuOpen;
          const toggleGroup = () => {
            if (isInventoryGroup) { setIsInventoryMenuOpen(c => !c); return; }
            if (isOperationsGroup) { setIsOperationsMenuOpen(c => !c); return; }
            setIsAccountingMenuOpen(c => !c);
          };
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center gap-2">
                <NavLink
                  to={item.path}
                  end
                  onClick={onNavClick}
                  className={({ isActive }) => cn(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                    isActive || isGroupRoute ? "bg-gray-100 text-black" : "text-gray-500 hover:bg-gray-100 hover:text-black"
                  )}
                >
                  <item.icon className="h-6 w-6 shrink-0" />
                  {isSidebarOpen && <span className="min-w-0 font-medium">{item.name}</span>}
                </NavLink>
                {isSidebarOpen && (
                  <button type="button" onClick={toggleGroup} className="rounded-xl p-2 text-gray-500 transition-all hover:bg-gray-100 hover:text-black">
                    {isGroupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {isSidebarOpen && isGroupOpen && (
                <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.path}
                      onClick={onNavClick}
                      className={({ isActive }) => cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all",
                        isActive ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <child.icon className="h-3.5 w-3.5 shrink-0 fill-current stroke-none" />
                      <span className="font-medium">{child.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavClick}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
              isActive ? "bg-gray-100 text-black" : "text-gray-500 hover:bg-gray-100 hover:text-black"
            )}
          >
            <item.icon className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">{item.name}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  const UserFooter = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="p-4 border-t border-gray-100">
      <div className={cn("flex items-center gap-3 p-3", !isSidebarOpen && "justify-center")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-semibold text-sm shrink-0">
          {(effectiveUser?.displayName || effectiveUser?.email || 'U')[0].toUpperCase()}
        </div>
        {isSidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{effectiveUser?.displayName || effectiveUser?.email}</p>
            <p className="text-xs text-gray-500 truncate">{effectiveUser?.email}</p>
          </div>
        )}
      </div>
      <button
        onClick={() => { navigate('/profile'); onNavClick?.(); }}
        className={cn("mt-2 w-full rounded-xl p-3 text-gray-700 transition-all hover:bg-gray-100 flex items-center gap-3", !isSidebarOpen && "justify-center")}
      >
        <User className="w-5 h-5" />
        {isSidebarOpen && <span className="font-medium">Profile</span>}
      </button>
      <button
        onClick={handleLogout}
        className={cn("mt-2 w-full rounded-xl p-3 text-red-500 transition-all hover:bg-red-50 flex items-center gap-3", !isSidebarOpen && "justify-center")}
      >
        <LogOut className="w-5 h-5" />
        {isSidebarOpen && <span className="font-medium">Logout</span>}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">
      <Toaster position="top-right" />

      {/* Desktop Sidebar */}
      <aside className={cn("hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out", isSidebarOpen ? "w-64" : "w-20")}>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 min-w-[40px] items-center justify-center rounded-xl bg-black">
              <Boxes className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && <span className="text-lg font-semibold tracking-tight">IMS Pro</span>}
          </div>
          {isDemoMode && isSidebarOpen && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Demo Mode</span>
            </div>
          )}
        </div>
        <NavContent />
        <UserFooter />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 left-0 w-64 bg-white z-50 md:hidden flex flex-col shadow-2xl">
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black"><Boxes className="text-white w-5 h-5" /></div>
                  <span className="text-lg font-semibold tracking-tight">IMS Pro</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <NavContent onNavClick={() => setIsMobileMenuOpen(false)} />
              <UserFooter onNavClick={() => setIsMobileMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="hidden text-lg font-semibold text-gray-800 sm:block">{currentPageTitle}</h2>
          </div>
          <div />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex min-w-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet context={{
                isDemoMode,
                user,
                balances,
                variants,
                products,
                warehouses,
                movements,
                revenueInvoices,
                transferInvoices,
                purchaseInvoices,
                returnInvoices,
                clientPayments,
                warehouseExpenses,
                transfers,
                brands,
                categories,
                suppliers,
                clients: effectiveClients,
                users,
                currentUserProfile,
                effectiveUser,
                loading,
                handleWarehouseClick,
                handleVariantClick,
                handleProductClick,
                handleMovementClick,
                handleHistoryClick,
                handleInvoiceClick,
              }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
