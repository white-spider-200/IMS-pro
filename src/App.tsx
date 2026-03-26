import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MasterDataPage from './components/MasterDataPage';
import InventoryDashboard from './pages/InventoryDashboard';
import ProcurementDashboard from './pages/ProcurementDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StockMovementHistory from './pages/StockMovementHistory';
import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

export default function App() {
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous snapshots
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (user) {
        const handleError = (error: any) => {
          console.error('Firestore snapshot error:', error);
          toast.error('Failed to sync data with server');
        };

        unsubs.push(onSnapshot(collection(db, 'brands'), 
          (s) => setBrands(s.docs.map(d => ({ label: d.data().name, value: d.id }))),
          handleError
        ));
        unsubs.push(onSnapshot(collection(db, 'categories'), 
          (s) => setCategories(s.docs.map(d => ({ label: d.data().name, value: d.id }))),
          handleError
        ));
        unsubs.push(onSnapshot(collection(db, 'products'), 
          (s) => setProducts(s.docs.map(d => ({ label: d.data().name, value: d.id }))),
          handleError
        ));
        unsubs.push(onSnapshot(collection(db, 'suppliers'), 
          (s) => setSuppliers(s.docs.map(d => ({ label: d.data().name, value: d.id }))),
          handleError
        ));
        unsubs.push(onSnapshot(collection(db, 'users'), 
          (s) => setUsers(s.docs.map(d => ({ label: d.data().displayName || d.data().email, value: d.id }))),
          handleError
        ));
      } else {
        setBrands([]);
        setCategories([]);
        setProducts([]);
        setSuppliers([]);
        setUsers([]);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<InventoryDashboard />} />
          <Route path="/inventory" element={<InventoryDashboard />} />
          <Route path="/procurement" element={<ProcurementDashboard />} />
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/movements" element={<StockMovementHistory />} />
          
          <Route path="/warehouses" element={<MasterDataPage 
            collectionName="warehouses" 
            title="Warehouse" 
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'location', label: 'Location', type: 'text' },
              { key: 'country', label: 'Country', type: 'text' },
              { key: 'manager_id', label: 'Warehouse Manager', type: 'select', options: users },
            ]} 
          />} />

          <Route path="/suppliers" element={<MasterDataPage 
            collectionName="suppliers" 
            title="Supplier" 
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'contact_info', label: 'Contact Info', type: 'text' },
              { key: 'country', label: 'Country', type: 'text' },
            ]} 
          />} />

          <Route path="/brands" element={<MasterDataPage 
            collectionName="brands" 
            title="Brand" 
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'country_of_origin', label: 'Country of Origin', type: 'text' },
            ]} 
          />} />

          <Route path="/categories" element={<MasterDataPage 
            collectionName="categories" 
            title="Category" 
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'parent_category_id', label: 'Parent Category', type: 'select', options: categories },
            ]} 
          />} />

          <Route path="/products" element={<MasterDataPage 
            collectionName="products" 
            title="Product" 
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'sku', label: 'SKU', type: 'text', required: true },
              { key: 'brand_id', label: 'Brand', type: 'select', options: brands },
              { key: 'category_id', label: 'Category', type: 'select', options: categories },
              { key: 'supplier_id', label: 'Supplier', type: 'select', options: suppliers },
              { key: 'description', label: 'Description', type: 'text' },
            ]} 
          />} />

          <Route path="/variants" element={<MasterDataPage 
            collectionName="product_variants" 
            title="Product Variant" 
            sortField="variant_code"
            fields={[
              { key: 'product_id', label: 'Product', type: 'select', options: products, required: true },
              { key: 'variant_code', label: 'Variant Code', type: 'text', required: true },
              { key: 'barcode', label: 'Barcode', type: 'text', required: true },
              { key: 'color', label: 'Color', type: 'text' },
              { key: 'size', label: 'Size', type: 'text' },
            ]} 
          />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
