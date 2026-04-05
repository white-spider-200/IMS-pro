import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MasterDataPage from './components/MasterDataPage';
import InventoryDashboard from './pages/InventoryDashboard';
import ProfilePage from './pages/ProfilePage';
import ClientTransfersPage from './pages/ClientTransfersPage';
import ClientPaymentsPage from './pages/ClientPaymentsPage';
import SupplierTransfersPage from './pages/SupplierTransfersPage';
import EntityReportPage from './pages/EntityReportPage';
import StockMovementHistory from './pages/StockMovementHistory';
import BuyPage from './pages/BuyPage';
import SellPage from './pages/SellPage';
import ReturnPage from './pages/ReturnPage';
import WarehouseExpensesPage from './pages/WarehouseExpensesPage';
import CogsReportPage from './pages/CogsReportPage';
import NetProfitPage from './pages/NetProfitPage';
import AccountingPage from './pages/AccountingPage';
import { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import { useSSE } from './lib/useSSE';
import { getToken } from './lib/localAuth';
import { useDemoMode } from './demo/demoMode';
import { getDemoDatabase, subscribeDemoDatabase } from './demo/demoDatabase';

export default function App() {
  const isDemoMode = useDemoMode();
  const isLoggedIn = !!getToken();

  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    if (isDemoMode) return;
    if (!getToken()) return;
    try {
      const [b, cat, p, sup, cli, u] = await Promise.all([
        api.collection.getAll('brands'),
        api.collection.getAll('categories'),
        api.collection.getAll('products'),
        api.collection.getAll('suppliers'),
        api.collection.getAll('clients'),
        api.collection.getAll('users'),
      ]);
      setBrands(b.map((d: any) => ({ label: d.name, value: d.id })));
      setCategories(cat.map((d: any) => ({ label: d.name, value: d.id })));
      setProducts(p.map((d: any) => ({ label: d.name, value: d.id })));
      setSuppliers(sup.map((d: any) => ({ label: d.name, value: d.id })));
      setClients(cli.map((d: any) => ({ label: d.name, value: d.id })));
      setUsers(u.map((d: any) => ({
        label: d.displayName || d.email,
        value: d.id,
        email: d.email,
        phone: d.phone,
        displayName: d.displayName,
      })));
    } catch (e) {
      console.error('Failed to fetch global data', e);
    }
  }, [isDemoMode]);

  // SSE: re-fetch collections when relevant data changes
  useSSE((collection) => {
    const globalCollections = ['brands', 'categories', 'products', 'suppliers', 'clients', 'users'];
    if (globalCollections.includes(collection)) {
      fetchAll();
    }
  }, isLoggedIn && !isDemoMode);

  useEffect(() => {
    if (isDemoMode) {
      const syncFromDemoDb = () => {
        const demoDb = getDemoDatabase();
        setBrands(demoDb.brands.map((item) => ({ label: item.name, value: item.id })));
        setCategories(demoDb.categories.map((item) => ({ label: item.name, value: item.id })));
        setProducts(demoDb.products.map((item) => ({ label: item.name, value: item.id })));
        setSuppliers(demoDb.suppliers.map((item) => ({ label: item.name, value: item.id })));
        setClients(demoDb.clients.map((item) => ({ label: item.name, value: item.id })));
        setUsers(demoDb.users.map((item) => ({
          label: item.displayName || item.email,
          value: item.id,
          email: item.email,
          phone: item.phone,
          displayName: item.displayName,
        })));
      };
      syncFromDemoDb();
      return subscribeDemoDatabase(syncFromDemoDb);
    }
    fetchAll();
  }, [isDemoMode, fetchAll]);

  const inventorySections = [
    {
      path: '/inventory/warehouses',
      element: (
        <MasterDataPage
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
        />
      ),
    },
    {
      path: '/inventory/clients',
      element: (
        <MasterDataPage
          collectionName="clients"
          title="Client"
          uniqueFields={['email', 'phone']}
          fields={[
            { key: 'client_code', label: 'Client ID', type: 'text', readOnly: true },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'email', label: 'Email', type: 'text', required: true },
            { key: 'phone', label: 'Phone Number', type: 'text', required: true },
            { key: 'location', label: 'Location/City', type: 'text' },
            { key: 'balance_due', label: 'Balance Due', type: 'number', hideInForm: true },
            { key: 'paid_amount', label: 'Paid Amount', type: 'number', hideInForm: true },
            { key: 'credit_balance', label: 'Client Credit', type: 'number', hideInForm: true, hideInTable: true },
          ]}
        />
      ),
    },
    {
      path: '/inventory/suppliers',
      element: (
        <MasterDataPage
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
        />
      ),
    },
    {
      path: '/inventory/brands',
      element: (
        <MasterDataPage
          collectionName="brands"
          title="Brand"
          uniqueField="name"
          fields={[
            { key: 'logo_url', label: 'Photo', type: 'image' },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'country_of_origin', label: 'Country of Origin', type: 'text' },
          ]}
        />
      ),
    },
    {
      path: '/inventory/categories',
      element: (
        <MasterDataPage
          collectionName="categories"
          title="Category"
          uniqueFields={['name', 'category_code']}
          hideStatus
          hardDelete
          fields={[
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'category_code', label: 'Category Code', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'text' },
          ]}
        />
      ),
    },
    {
      path: '/inventory/products',
      element: (
        <MasterDataPage
          collectionName="products"
          title="Product"
          uniqueField="sku"
          fields={[
            { key: 'image_url', label: 'Photo', type: 'image' },
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'sku', label: 'SKU', type: 'text', required: true },
            { key: 'brand_id', label: 'Brand', type: 'select', options: brands },
            { key: 'category_id', label: 'Category', type: 'select', options: categories },
            { key: 'description', label: 'Description', type: 'text' },
          ]}
        />
      ),
    },
    {
      path: '/inventory/variants',
      element: (
        <MasterDataPage
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
        />
      ),
    },
  ];

  const [warehousesSection, clientsSection, suppliersSection, brandsSection, categoriesSection, productsSection, variantsSection] = inventorySections;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<InventoryDashboard />} />
          <Route path="/warehouses/:warehouseId/details" element={<EntityReportPage entityType="warehouses" />} />
          <Route path="/clients/:clientId/transfers" element={<ClientTransfersPage />} />
          <Route path="/clients/:clientId/payments" element={<ClientPaymentsPage />} />
          <Route path="/suppliers/:supplierId/transfers" element={<SupplierTransfersPage />} />
          <Route path="/brands/:brandId/details" element={<EntityReportPage entityType="brands" />} />
          <Route path="/categories/:categoryId/details" element={<EntityReportPage entityType="categories" />} />
          <Route path="/products/:productId/details" element={<EntityReportPage entityType="products" />} />
          <Route path="/variants/:variantId/details" element={<EntityReportPage entityType="product_variants" />} />

          <Route path="/inventory" element={<Navigate to="/" replace />} />
          <Route path={warehousesSection.path} element={warehousesSection.element} />
          <Route path={clientsSection.path} element={clientsSection.element} />
          <Route path={suppliersSection.path} element={suppliersSection.element} />
          <Route path={brandsSection.path} element={brandsSection.element} />
          <Route path={categoriesSection.path} element={categoriesSection.element} />
          <Route path={productsSection.path} element={productsSection.element} />
          <Route path={variantsSection.path} element={variantsSection.element} />

          <Route path="/warehouses" element={<Navigate to="/inventory/warehouses" replace />} />
          <Route path="/clients" element={<Navigate to="/inventory/clients" replace />} />
          <Route path="/suppliers" element={<Navigate to="/inventory/suppliers" replace />} />
          <Route path="/brands" element={<Navigate to="/inventory/brands" replace />} />
          <Route path="/categories" element={<Navigate to="/inventory/categories" replace />} />
          <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
          <Route path="/variants" element={<Navigate to="/inventory/variants" replace />} />

          <Route path="/buy" element={<BuyPage />} />
          <Route path="/sell" element={<SellPage />} />
          <Route path="/return" element={<ReturnPage />} />
          <Route path="/expenses" element={<WarehouseExpensesPage />} />
          <Route path="/cogs" element={<CogsReportPage />} />
          <Route path="/net-profit" element={<NetProfitPage />} />
          <Route path="/accounting" element={<Navigate to="/accounting/profit-loss" replace />} />
          <Route path="/accounting/profit-loss" element={<AccountingPage reportType="profit-loss" />} />
          <Route path="/accounting/aged-receivable" element={<AccountingPage reportType="aged-receivable" />} />
          <Route path="/accounting/aged-payable" element={<AccountingPage reportType="aged-payable" />} />
          <Route path="/accounting/cash-flow" element={<AccountingPage reportType="cash-flow" />} />
          <Route path="/accounting/tax-report" element={<AccountingPage reportType="tax-report" />} />
          <Route path="/accounting/accounts-receivable" element={<Navigate to="/accounting/aged-receivable" replace />} />
          <Route path="/accounting/accounts-payable" element={<Navigate to="/accounting/aged-payable" replace />} />
          <Route path="/accounting/cashflow" element={<Navigate to="/accounting/cash-flow" replace />} />
          <Route path="/accounting/vat-summary" element={<Navigate to="/accounting/tax-report" replace />} />

          <Route path="/reports/movements" element={<StockMovementHistory />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
