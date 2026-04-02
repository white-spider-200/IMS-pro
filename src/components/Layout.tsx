import React, { useEffect, useMemo, useState } from 'react';
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
  RotateCcw
  ,
  Wallet,
  ReceiptText,
  LineChart,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, signInWithPopup, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { cn } from '../lib/utils';
import { enableDemoMode, useDemoMode, disableDemoMode } from '../demo/demoMode';
import * as demoData from '../demo/demoData';
import { getDemoDatabase, subscribeDemoDatabase } from '../demo/demoDatabase';
import { getDemoProfile, subscribeDemoProfile } from '../demo/demoProfile';
import { isFirestoreSyncPaused, subscribeFirestoreSyncPause } from '../lib/syncPause';
import { mergeClientsWithFinancials } from '../lib/clientFinancials';

function getLoginErrorMessage(error: any) {
  switch (error?.code) {
    case 'auth/popup-blocked':
      return 'Popup login was blocked. Retrying with redirect sign-in.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in popup was closed before login completed.';
    case 'auth/unauthorized-domain':
      return 'This localhost domain is not authorized in Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    case 'auth/network-request-failed':
      return 'The login request could not reach Firebase. Check your network and browser privacy settings.';
    default:
      return error?.message || 'Login failed';
  }
}

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

  // Global Modals State
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
  const isOperationsRoute = ['/buy', '/sell', '/return', '/expenses', '/cogs', '/net-profit'].some((path) => location.pathname.startsWith(path));
  const [isInventoryMenuOpen, setIsInventoryMenuOpen] = useState(isInventoryRoute);
  const [isOperationsMenuOpen, setIsOperationsMenuOpen] = useState(isOperationsRoute);
  const demoProfile = getDemoProfile();
  const currentUserProfile = users.find((entry) => entry.id === user?.uid) || null;
  const effectiveUser = user
    ? {
      ...user,
      ...currentUserProfile,
      displayName: currentUserProfile?.displayName || user.displayName,
      email: currentUserProfile?.email || user.email,
      photoURL: currentUserProfile?.photoURL || user.photoURL,
    }
    : null;
  const effectiveClients = useMemo(
    () => mergeClientsWithFinancials(clients, revenueInvoices, purchaseInvoices, clientPayments),
    [clientPayments, clients, purchaseInvoices, revenueInvoices]
  );

  useEffect(() => {
    if (!isDemoMode) return;
    return subscribeDemoProfile(() => {
      setDemoProfileVersion((current) => current + 1);
    });
  }, [isDemoMode]);

  useEffect(() => subscribeFirestoreSyncPause(() => {
    setIsSyncPaused(isFirestoreSyncPaused());
  }), []);

  useEffect(() => {
    if (isInventoryRoute) {
      setIsInventoryMenuOpen(true);
    }
  }, [isInventoryRoute]);

  useEffect(() => {
    if (isOperationsRoute) {
      setIsOperationsMenuOpen(true);
    }
  }, [isOperationsRoute]);

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
      movements: movements.filter(m => m.warehouse_id === warehouseId)
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
      distribution: balances.filter(b => b.variant_id === variantId)
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
      distribution: balances.filter(b => b.variant_id === variantId)
    });
    setIsProductModalOpen(true);
  };

  const handleMovementClick = (movement: any) => {
    setSelectedMovement(movement);
    setIsMovementModalOpen(true);
  };

  const handleHistoryClick = (item: any) => {
    const history = movements
      .filter(m => m.variant_id === item.variant_id && m.warehouse_id === item.warehouse_id)
      .sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });

    setSelectedHistory({
      balance: item,
      history: history
    });
    setIsHistoryModalOpen(true);
  };

  const handleInvoiceClick = (variantId: string, warehouseId: string) => {
    const invoice = revenueInvoices
      .filter(inv => inv.warehouse_id === warehouseId && inv.items.some((item: any) => item.variant_id === variantId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (invoice) {
      setSelectedInvoice(invoice);
      setIsInvoiceModalOpen(true);
    } else {
      toast.info('No revenue invoice found for this item in this warehouse.');
    }
  };

  useEffect(() => {
    if (isDemoMode) {
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
    }

    if (isSyncPaused) {
      setLoading(false);
      return;
    }

    const unsubBalances = onSnapshot(collection(db, "inventory_balances"), (s) => setBalances(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVariants = onSnapshot(collection(db, "product_variants"), (s) => setVariants(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProducts = onSnapshot(collection(db, "products"), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWarehouses = onSnapshot(collection(db, "warehouses"), (s) => setWarehouses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMovements = onSnapshot(collection(db, "stock_movements"), (s) => setMovements(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })), 'timestamp')));
    const unsubInvoices = onSnapshot(collection(db, "revenue_invoices"), (s) => setRevenueInvoices(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubTransferInvoices = onSnapshot(collection(db, "transfer_invoices"), (s) => setTransferInvoices(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubPurchaseInvoices = onSnapshot(collection(db, "purchase_invoices"), (s) => setPurchaseInvoices(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubReturnInvoices = onSnapshot(collection(db, "return_invoices"), (s) => setReturnInvoices(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubClientPayments = onSnapshot(collection(db, "client_payments"), (s) => setClientPayments(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubWarehouseExpenses = onSnapshot(collection(db, "warehouse_expenses"), (s) => setWarehouseExpenses(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubTransfers = onSnapshot(collection(db, "transfers"), (s) => setTransfers(sortByNewest(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    const unsubBrands = onSnapshot(collection(db, "brands"), (s) => setBrands(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCategories = onSnapshot(collection(db, "categories"), (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSuppliers = onSnapshot(collection(db, "suppliers"), (s) => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, "clients"), (s) => setClients(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => {
      unsubBalances(); unsubVariants(); unsubProducts(); unsubWarehouses(); unsubMovements(); unsubInvoices(); unsubTransferInvoices(); unsubPurchaseInvoices(); unsubReturnInvoices(); unsubClientPayments(); unsubWarehouseExpenses(); unsubTransfers(); unsubBrands(); unsubCategories(); unsubSuppliers(); unsubClients(); unsubUsers();
    };
  }, [isDemoMode, isSyncPaused]);

  useEffect(() => {
    if (isDemoMode) {
      setUser({
        uid: 'demo-user-id',
        email: demoProfile.email || demoData.demoUser.email,
        displayName: demoProfile.displayName || demoData.demoUser.name,
        photoURL: demoProfile.photoURL || null,
        phone: demoProfile.phone || '',
        location: demoProfile.location || '',
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          const basicInfo = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            last_login: serverTimestamp(),
          };

          await setDoc(userRef, basicInfo, { merge: true });

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (!data.phone || !data.location) {
              if (location.pathname !== '/profile') {
                toast.info('Complete your profile to keep your contact information up to date.');
                navigate('/profile');
              }
            }
          } else {
            if (location.pathname !== '/profile') {
              toast.info('Complete your profile to keep your contact information up to date.');
              navigate('/profile');
            }
          }
        } catch (error) {
          console.error('Failed to update user profile:', error);
        }
      }
    });
    return () => unsubscribe();
  }, [isDemoMode, location.pathname, navigate, demoProfileVersion]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/popup-blocked') {
        toast.info('Popup blocked. Switching to redirect sign-in...');
        await signInWithRedirect(auth, provider);
        return;
      }
      toast.error(getLoginErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      disableDemoMode();
      toast.success('Exited Demo Mode');
      navigate('/');
      return;
    }

    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('Logout failed');
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    toast.success('Demo mode enabled');
  };

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

  const navItems = [
    { name: 'Inventory', icon: Boxes, path: '/', children: inventoryChildren },
    { name: 'Operations', icon: ReceiptText, path: '/buy', children: operationsChildren },
  ];

  const currentPageTitle = inventoryChildren.find((item) => item.path === location.pathname)?.name
    || operationsChildren.find((item) => item.path === location.pathname)?.name
    || navItems.find((item) => item.path === location.pathname)?.name
    || 'Inventory';

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-surface max-w-md w-full p-8 text-center"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-black">
            <Boxes className="text-white w-8 h-8" />
          </div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">IMS Pro</h1>
          <p className="mb-8 text-sm text-gray-500">Multi-Warehouse Inventory Management System</p>
          <button
            onClick={handleLogin}
            className="app-button-primary w-full py-3.5"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
          <button
            onClick={handleDemoMode}
            className="app-button-secondary mt-3 w-full py-3.5"
          >
            Continue in Local Demo Mode
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Local login depends on Firebase Authentication being enabled for this project and domain.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">
      <Toaster position="top-right" />

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
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

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            if (item.children) {
              const isInventoryGroup = item.name === 'Inventory';
              const isGroupRoute = isInventoryGroup ? isInventoryRoute : isOperationsRoute;
              const isGroupOpen = isInventoryGroup ? isInventoryMenuOpen : isOperationsMenuOpen;
              const toggleGroup = () => (isInventoryGroup ? setIsInventoryMenuOpen((current) => !current) : setIsOperationsMenuOpen((current) => !current));
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <NavLink
                      to={item.path}
                      end
                      className={({ isActive }) => cn(
                        "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                        isActive || isGroupRoute
                          ? "bg-gray-100 text-black"
                          : "text-gray-500 hover:bg-gray-100 hover:text-black"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {isSidebarOpen && <span className="min-w-0 font-medium">{item.name}</span>}
                    </NavLink>
                    {isSidebarOpen && (
                      <button
                        type="button"
                        onClick={toggleGroup}
                        className="rounded-xl p-2 text-gray-500 transition-all hover:bg-gray-100 hover:text-black"
                        aria-label={isGroupOpen ? `Collapse ${item.name} menu` : `Expand ${item.name} menu`}
                      >
                        {isGroupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {isSidebarOpen && isGroupOpen && (
                    <div className="space-y-1 pl-4">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.name}
                          to={child.path}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                            isActive
                              ? "bg-gray-100 text-black"
                              : "text-gray-500 hover:bg-gray-100 hover:text-black"
                          )}
                        >
                          <child.icon className="h-4 w-4" />
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
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                  isActive
                    ? "bg-gray-100 text-black"
                    : "text-gray-500 hover:bg-gray-100 hover:text-black"
                )}
              >
                <item.icon className="w-5 h-5" />
                {isSidebarOpen && <span className="font-medium">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className={cn("flex items-center gap-3 p-3", !isSidebarOpen && "justify-center")}>
            <img
              src={effectiveUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(effectiveUser?.displayName || 'User')}`}
              alt="Avatar"
              className="w-8 h-8 rounded-full border border-gray-200"
              referrerPolicy="no-referrer"
            />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{effectiveUser?.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{effectiveUser?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/profile')}
            className={cn(
              "mt-2 w-full rounded-xl p-3 text-gray-700 transition-all hover:bg-gray-100 flex items-center gap-3",
              !isSidebarOpen && "justify-center"
            )}
          >
            <User className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Profile</span>}
          </button>
          <button
            onClick={handleLogout}
            className={cn(
              "mt-2 w-full rounded-xl p-3 text-red-500 transition-all hover:bg-red-50 flex items-center gap-3",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed inset-y-0 left-0 w-64 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
                    <Boxes className="text-white w-5 h-5" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">IMS Pro</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => {
                  if (item.children) {
                    const isInventoryGroup = item.name === 'Inventory';
                    const isGroupRoute = isInventoryGroup ? isInventoryRoute : isOperationsRoute;
                    const isGroupOpen = isInventoryGroup ? isInventoryMenuOpen : isOperationsMenuOpen;
                    const toggleGroup = () => (isInventoryGroup ? setIsInventoryMenuOpen((current) => !current) : setIsOperationsMenuOpen((current) => !current));
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <NavLink
                            to={item.path}
                            end
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) => cn(
                              "flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                              isActive || isGroupRoute
                                ? "bg-gray-100 text-black"
                                : "text-gray-500 hover:bg-gray-100 hover:text-black"
                            )}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                          </NavLink>
                          <button
                            type="button"
                            onClick={toggleGroup}
                            className="rounded-xl p-2 text-gray-500 transition-all hover:bg-gray-100 hover:text-black"
                            aria-label={isGroupOpen ? `Collapse ${item.name} menu` : `Expand ${item.name} menu`}
                          >
                            {isGroupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>

                        {isGroupOpen && (
                          <div className="space-y-1 pl-4">
                            {item.children.map((child) => (
                              <NavLink
                                key={child.name}
                                to={child.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => cn(
                                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                                  isActive
                                    ? "bg-gray-100 text-black"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-black"
                                )}
                              >
                                <child.icon className="h-4 w-4" />
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
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                        isActive
                          ? "bg-gray-100 text-black"
                          : "text-gray-500 hover:bg-gray-100 hover:text-black"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-gray-700 transition-all hover:bg-gray-100 mb-2"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Profile</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-red-500 transition-all hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="hidden text-lg font-semibold text-gray-800 sm:block">
              {currentPageTitle}
            </h2>
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
                handleInvoiceClick
              }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
