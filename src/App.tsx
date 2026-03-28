// Test comment
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MasterDataPage from './components/MasterDataPage';
import InventoryDashboard from './pages/InventoryDashboard';
import StockMovementHistory from './pages/StockMovementHistory';
import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import DemoApp from './demo/DemoApp';
import { useDemoMode } from './demo/demoMode';

export default function App() {
  const isDemoMode = useDemoMode();
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
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
        unsubs.push(onSnapshot(collection(db, 'clients'),
          (s) => setClients(s.docs.map(d => ({ label: d.data().name, value: d.id }))),
          handleError
        ));
        unsubs.push(onSnapshot(collection(db, 'users'),
          (s) => setUsers(s.docs.map(d => ({
            label: d.data().displayName || d.data().email,
            value: d.id,
            email: d.data().email,
            phone: d.data().phone,
            displayName: d.data().displayName,
          }))),
          handleError
        ));
      } else {
        setBrands([]);
        setCategories([]);
        setProducts([]);
        setSuppliers([]);
        setClients([]);
        setUsers([]);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  if (isDemoMode) {
    return (
      <BrowserRouter>
        <DemoApp />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<InventoryDashboard />} />
          <Route path="/movements" element={<StockMovementHistory />} />

          <Route path="/warehouses" element={<MasterDataPage
            collectionName="warehouses"
            title="Warehouse"
            uniqueField="name"
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              {
                key: 'manager_overview',
                label: 'Manager',
                type: 'text',
                hideInForm: true,
                clickable: true,
                getDisplayValue: (item) => {
                  const systemManager = users.find((user: any) => user.value === item.manager_id);
                  return systemManager?.label || item.manual_manager_name || 'No manager assigned';
                },
              },
              { key: 'location', label: 'Location', type: 'text' },
              { key: 'country', label: 'Country', type: 'text' },
              { key: 'manager_id', label: 'System Manager', type: 'select', options: users, hideInTable: true, hideInDetails: true },
              { key: 'manual_manager_name', label: 'Manual Manager Name', type: 'text', hideInTable: true, hideInDetails: true },
              { key: 'manual_manager_phone', label: 'Manual Manager Phone', type: 'text', hideInTable: true, hideInDetails: true },
              { key: 'manual_manager_email', label: 'Manual Manager Email', type: 'text', hideInTable: true, hideInDetails: true },
            ]}
          />} />

          <Route path="/clients" element={<MasterDataPage
            collectionName="clients"
            title="Client"
            uniqueFields={['email', 'phone']}
            fields={[
              { key: 'client_code', label: 'Client ID', type: 'text', readOnly: true },
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'email', label: 'Email', type: 'text', required: true },
              { key: 'phone', label: 'Phone Number', type: 'text', required: true },
              { key: 'location', label: 'Location/City', type: 'text' },
            ]}
          />} />

          <Route path="/suppliers" element={<MasterDataPage
            collectionName="suppliers"
            title="Supplier"
            uniqueFields={['supplier_code', 'email', 'phone']}
            fields={[
              { key: 'supplier_code', label: 'Supplier ID', type: 'text', readOnly: true },
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'email', label: 'Email', type: 'text', required: true },
              { key: 'phone', label: 'Phone Number', type: 'text', required: true },
              { key: 'country', label: 'Country', type: 'text' },
            ]}
          />} />

          <Route path="/brands" element={<MasterDataPage
            collectionName="brands"
            title="Brand"
            uniqueField="name"
            fields={[
              { key: 'logo_url', label: 'Photo', type: 'image' },
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'country_of_origin', label: 'Country of Origin', type: 'text' },
            ]}
          />} />

          <Route path="/categories" element={<MasterDataPage
            collectionName="categories"
            title="Category"
            uniqueFields={['name', 'category_code']}
            hideStatus
            hardDelete
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'category_code', label: 'Category Code', type: 'text', required: true },
              { key: 'parent_category_id', label: 'Parent Category', type: 'select', options: categories },
              { key: 'description', label: 'Description', type: 'text' },
              { key: 'priority', label: 'Sort Priority', type: 'number' },
            ]}
          />} />

          <Route path="/products" element={<MasterDataPage
            collectionName="products"
            title="Product"
            uniqueField="sku"
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
            uniqueField="barcode"
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
