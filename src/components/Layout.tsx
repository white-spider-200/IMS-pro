import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Warehouse as WarehouseIcon, 
  Truck, 
  Tag, 
  Layers, 
  Package, 
  Boxes, 
  History as HistoryIcon, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Plus,
  Search,
  ChevronRight,
  User,
  ShoppingCart,
  Activity,
  TrendingUp
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { cn } from '../lib/utils';
import AutocompleteSearch from './AutocompleteSearch';

export default function Layout() {
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Update user profile in Firestore
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            last_login: serverTimestamp(),
            // Don't overwrite role if it already exists
          }, { merge: true });
        } catch (error) {
          console.error('Failed to update user profile:', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error) {
      console.error(error);
      toast.error('Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('Logout failed');
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Admin', icon: TrendingUp, path: '/admin' },
    { name: 'Manager', icon: Activity, path: '/manager' },
    { name: 'Procurement', icon: ShoppingCart, path: '/procurement' },
    { name: 'Inventory', icon: Boxes, path: '/inventory' },
    { name: 'Warehouses', icon: WarehouseIcon, path: '/warehouses' },
    { name: 'Suppliers', icon: Truck, path: '/suppliers' },
    { name: 'Brands', icon: Tag, path: '/brands' },
    { name: 'Categories', icon: Layers, path: '/categories' },
    { name: 'Products', icon: Package, path: '/products' },
    { name: 'Variants', icon: Tag, path: '/variants' },
    { name: 'Movements', icon: HistoryIcon, path: '/movements' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Boxes className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">IMS Pro</h1>
          <p className="text-gray-500 mb-8">Multi-Warehouse Inventory Management System</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-black text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-3 hover:bg-gray-800 transition-colors"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
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
        <div className="p-6 flex items-center gap-3">
          <div className="min-w-[40px] h-10 bg-black rounded-xl flex items-center justify-center">
            <Boxes className="text-white w-5 h-5" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">IMS Pro</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all",
                isActive 
                  ? "bg-black text-white shadow-lg" 
                  : "text-gray-500 hover:bg-gray-100 hover:text-black"
              )}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className={cn("flex items-center gap-3 p-3", !isSidebarOpen && "justify-center")}>
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-gray-200"
              referrerPolicy="no-referrer"
            />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 p-3 mt-2 text-red-500 hover:bg-red-50 rounded-xl transition-all",
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
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <Boxes className="text-white w-5 h-5" />
                  </div>
                  <span className="font-bold text-xl tracking-tight">IMS Pro</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all",
                      isActive 
                        ? "bg-black text-white shadow-lg" 
                        : "text-gray-500 hover:bg-gray-100 hover:text-black"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="p-4 border-t border-gray-100">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
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
            <h2 className="text-lg font-semibold text-gray-800 hidden sm:block">
              {navItems.find(item => item.path === window.location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <AutocompleteSearch 
                value={searchTerm}
                onChange={setSearchTerm}
                suggestions={[]} // Global search suggestions could be added here
                placeholder="Search anything..."
                className="w-64"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
