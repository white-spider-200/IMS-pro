import { db } from '../firebase';
import { collection, addDoc, deleteDoc, getDocs, query, limit, where, updateDoc } from 'firebase/firestore';

const BUSINESS_COLLECTIONS = [
  'warehouses',
  'suppliers',
  'brands',
  'categories',
  'products',
  'product_variants',
  'inventory_balances',
  'stock_movements',
  'purchase_orders',
  'backorders',
  'reservations',
  'revenue_invoices',
  'receipt_invoices',
  'clients',
];

async function deleteCollectionDocuments(collectionName: string) {
  const snapshot = await getDocs(collection(db, collectionName));
  await Promise.all(snapshot.docs.map((document) => deleteDoc(document.ref)));
}

export async function clearAllData() {
  for (const collectionName of BUSINESS_COLLECTIONS) {
    await deleteCollectionDocuments(collectionName);
  }
}

export async function seedInitialData() {
  const warehousesSnap = await getDocs(query(collection(db, 'warehouses'), limit(1)));
  if (!warehousesSnap.empty) return; // Already seeded

  console.log('Seeding initial data...');

  // 1. Warehouses
  const w1 = await addDoc(collection(db, 'warehouses'), {
    name: 'Central Logistics Hub',
    location: 'London Heathrow',
    country: 'United Kingdom',
    status: 'active',
    manager_name: 'John Manager',
    manager_email: 'manager1@example.com'
  });
  const w2 = await addDoc(collection(db, 'warehouses'), {
    name: 'Northern Distribution Center',
    location: 'Manchester',
    country: 'United Kingdom',
    status: 'active',
    manager_name: 'Sarah Supervisor',
    manager_email: 'manager2@example.com'
  });
  const w3 = await addDoc(collection(db, 'warehouses'), {
    name: 'European Gateway',
    location: 'Rotterdam',
    country: 'Netherlands',
    status: 'active',
    manager_name: 'Hans Visser',
    manager_email: 'hans@example.com'
  });

  // 1.1 Users (Managers & Staff)
  const u1 = await addDoc(collection(db, 'users'), { email: 'manager1@example.com', displayName: 'John Manager', role: 'manager', warehouse_ids: [w1.id], created_at: new Date().toISOString() });
  const u2 = await addDoc(collection(db, 'users'), { email: 'manager2@example.com', displayName: 'Sarah Supervisor', role: 'manager', warehouse_ids: [w2.id], created_at: new Date().toISOString() });
  const u3 = await addDoc(collection(db, 'users'), { email: 'hans@example.com', displayName: 'Hans Visser', role: 'manager', warehouse_ids: [w3.id], created_at: new Date().toISOString() });
  await addDoc(collection(db, 'users'), { email: 'admin@example.com', displayName: 'System Admin', role: 'admin', created_at: new Date().toISOString() });

  // Update warehouses with manager_id
  await updateDoc(w1, { manager_id: u1.id });
  await updateDoc(w2, { manager_id: u2.id });
  await updateDoc(w3, { manager_id: u3.id });

  // 2. Suppliers
  const s1 = await addDoc(collection(db, 'suppliers'), { name: 'Global Tech Industries', contact_info: 'sales@globaltech.com', country: 'USA', status: 'active', lead_time_days: 14 });
  const s2 = await addDoc(collection(db, 'suppliers'), { name: 'EuroParts Manufacturing', contact_info: 'info@europarts.be', country: 'Belgium', status: 'active', lead_time_days: 7 });
  const s3 = await addDoc(collection(db, 'suppliers'), { name: 'Asia Component Corp', contact_info: 'orders@asiacorp.tw', country: 'Taiwan', status: 'active', lead_time_days: 21 });

  // 3. Brands
  const b1 = await addDoc(collection(db, 'brands'), { name: 'TechPro', country_of_origin: 'USA', status: 'active' });
  const b2 = await addDoc(collection(db, 'brands'), { name: 'EcoFlow', country_of_origin: 'Germany', status: 'active' });
  const b3 = await addDoc(collection(db, 'brands'), { name: 'Zenith', country_of_origin: 'Japan', status: 'active' });

  // 4. Categories
  const c1 = await addDoc(collection(db, 'categories'), { name: 'Electronics' });
  const c2 = await addDoc(collection(db, 'categories'), { name: 'Computing', parent_category_id: c1.id });
  const c3 = await addDoc(collection(db, 'categories'), { name: 'Peripherals', parent_category_id: c1.id });
  const c4 = await addDoc(collection(db, 'categories'), { name: 'Networking', parent_category_id: c1.id });

  // 4.5 Clients
  const cl1 = await addDoc(collection(db, 'clients'), { client_code: 'CLI-001', name: 'Global Solutions Inc', email: 'purchasing@globalsolutions.com', phone: '555-0101', location: 'New York, USA', status: 'active' });
  const cl2 = await addDoc(collection(db, 'clients'), { client_code: 'CLI-002', name: 'Creative Agency Ltd', email: 'orders@creativeagency.co.uk', phone: '555-0202', location: 'London, UK', status: 'active' });

  // 5. Products
  const p1 = await addDoc(collection(db, 'products'), {
    name: 'TechPro X1 Carbon',
    sku: 'TP-X1-C',
    brand_id: b1.id,
    category_id: c2.id,
    supplier_id: s1.id,
    status: 'active',
    description: 'High-performance business ultrabook'
  });

  const p2 = await addDoc(collection(db, 'products'), {
    name: 'EcoMouse Wireless Pro',
    sku: 'EM-W-PRO',
    brand_id: b2.id,
    category_id: c3.id,
    supplier_id: s2.id,
    status: 'active',
    description: 'Ergonomic sustainable wireless mouse'
  });

  const p3 = await addDoc(collection(db, 'products'), {
    name: 'Zenith Router AX6000',
    sku: 'ZN-AX6000',
    brand_id: b3.id,
    category_id: c4.id,
    supplier_id: s3.id,
    status: 'active',
    description: 'Next-gen WiFi 6 high-speed router'
  });

  // 6. Variants
  const v1 = await addDoc(collection(db, 'product_variants'), {
    product_id: p1.id,
    variant_code: 'X1-SILVER-16GB-512GB',
    barcode: '1234567890123',
    color: 'Silver',
    size: '14 inch',
    reorder_threshold: 20,
    unit_cost: 1200,
    unit_price: 1800,
    status: 'active',
    photo_url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=400'
  });

  const v2 = await addDoc(collection(db, 'product_variants'), {
    product_id: p1.id,
    variant_code: 'X1-BLACK-32GB-1TB',
    barcode: '1234567890124',
    color: 'Matte Black',
    size: '14 inch',
    reorder_threshold: 15,
    unit_cost: 1600,
    unit_price: 2400,
    status: 'active',
    photo_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=400'
  });

  const v3 = await addDoc(collection(db, 'product_variants'), {
    product_id: p2.id,
    variant_code: 'EM-PRO-GRAY',
    barcode: '9876543210987',
    color: 'Space Gray',
    reorder_threshold: 50,
    unit_cost: 45,
    unit_price: 89,
    status: 'active',
    photo_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=400'
  });

  const v4 = await addDoc(collection(db, 'product_variants'), {
    product_id: p3.id,
    variant_code: 'AX6000-WHITE',
    barcode: '4567890123456',
    color: 'White',
    reorder_threshold: 10,
    unit_cost: 180,
    unit_price: 299,
    status: 'active'
  });

  // 7. Initial Balances & Movements
  const initialStock = [
    { variant: v1.id, warehouse: w1.id, qty: 45 },
    { variant: v1.id, warehouse: w2.id, qty: 12 },
    { variant: v2.id, warehouse: w1.id, qty: 30 },
    { variant: v3.id, warehouse: w1.id, qty: 120 },
    { variant: v3.id, warehouse: w2.id, qty: 8 },
    { variant: v4.id, warehouse: w3.id, qty: 25 }
  ];

  for (const stock of initialStock) {
    await addDoc(collection(db, 'inventory_balances'), {
      variant_id: stock.variant,
      warehouse_id: stock.warehouse,
      available_quantity: stock.qty,
      reserved_quantity: 0,
      blocked_quantity: 0,
      version: 1,
      last_modified: new Date().toISOString()
    });

    await addDoc(collection(db, 'stock_movements'), {
      variant_id: stock.variant,
      warehouse_id: stock.warehouse,
      movement_type: 'receipt',
      quantity: stock.qty,
      idempotency_key: `seed_${stock.variant}_${stock.warehouse}`,
      timestamp: new Date().toISOString(),
      notes: 'Initial inventory load',
      status: 'completed'
    });
  }

  // 8. Pending Movements
  const pendingMovements = [
    {
      variant_id: v1.id,
      warehouse_id: w1.id,
      movement_type: 'receipt',
      quantity: 50,
      status: 'pending_qc',
      timestamp: new Date().toISOString(),
      idempotency_key: 'seed_pending_qc_1',
      user_id: 'system'
    },
    {
      variant_id: v4.id,
      warehouse_id: w3.id,
      movement_type: 'transfer_in',
      quantity: 15,
      status: 'in_transit',
      timestamp: new Date().toISOString(),
      idempotency_key: 'seed_transit_1',
      user_id: 'system'
    }
  ];

  for (const m of pendingMovements) {
    await addDoc(collection(db, 'stock_movements'), m);
  }

  // 9. Reservations
  const now = new Date();
  const reservations = [
    {
      variant_id: v1.id,
      warehouse_id: w1.id,
      quantity: 5,
      order_reference: 'SO-2026-101',
      expiry_timestamp: new Date(now.getTime() + 48 * 60 * 60000).toISOString(),
      status: 'active',
      created_at: now.toISOString()
    },
    {
      variant_id: v3.id,
      warehouse_id: w1.id,
      quantity: 20,
      order_reference: 'SO-2026-102',
      expiry_timestamp: new Date(now.getTime() + 2 * 60 * 60000).toISOString(),
      status: 'active',
      created_at: now.toISOString()
    }
  ];

  for (const r of reservations) {
    await addDoc(collection(db, 'reservations'), r);
    // Update balance
    const q = query(collection(db, 'inventory_balances'), where('variant_id', '==', r.variant_id), where('warehouse_id', '==', r.warehouse_id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const b = snap.docs[0];
      await updateDoc(b.ref, {
        available_quantity: b.data().available_quantity - r.quantity,
        reserved_quantity: b.data().reserved_quantity + r.quantity,
        last_modified: new Date().toISOString()
      });
    }
  }

  // 10. Purchase Orders
  await addDoc(collection(db, 'purchase_orders'), {
    supplier_id: s1.id,
    warehouse_id: w1.id,
    items: [{ variant_id: v1.id, quantity: 100, unit_cost: 1200 }],
    total_amount: 120000,
    status: 'sent',
    expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  });

  await addDoc(collection(db, 'purchase_orders'), {
    supplier_id: s3.id,
    warehouse_id: w3.id,
    items: [{ variant_id: v4.id, quantity: 40, unit_cost: 180 }],
    total_amount: 7200,
    status: 'in_transit',
    expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  });

  // 11. Backorders
  await addDoc(collection(db, 'backorders'), {
    variant_id: v3.id,
    warehouse_id: w2.id,
    quantity: 15,
    order_reference: 'SO-BACK-001',
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  });

  // 12. Revenue Invoices
  await addDoc(collection(db, 'revenue_invoices'), {
    invoice_number: 'INV-2026-0001',
    customer_name: 'Global Solutions Inc',
    client_id: cl1.id,
    items: [{ variant_id: v1.id, quantity: 10, unit_price: 1800, total: 18000 }],
    total_amount: 18000,
    status: 'paid',
    warehouse_id: w1.id,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  await addDoc(collection(db, 'revenue_invoices'), {
    invoice_number: 'INV-2026-0002',
    customer_name: 'Creative Agency Ltd',
    client_id: cl2.id,
    items: [{ variant_id: v3.id, quantity: 25, unit_price: 89, total: 2225 }],
    total_amount: 2225,
    status: 'pending',
    warehouse_id: w1.id,
    created_at: new Date().toISOString()
  });

  console.log('Seeding complete!');
}

export async function seedBigData() {
  console.log('Seeding curated big data batch...');

  const warehouses = [
    { name: 'Midwest Hub', location: 'Chicago, Illinois', country: 'USA', manual_manager_name: 'Mia Alvarez', manual_manager_phone: '+1 312 555 0137', manual_manager_email: 'mia.alvarez@midwesthub.example' },
    { name: 'Pacific Gateway', location: 'Long Beach, California', country: 'USA', manual_manager_name: 'Jason Reed', manual_manager_phone: '+1 562 555 0188', manual_manager_email: 'jason.reed@pacificgateway.example' },
    { name: 'Northern Relay', location: 'Toronto, Ontario', country: 'Canada', manual_manager_name: 'Leila Khan', manual_manager_phone: '+1 416 555 0174', manual_manager_email: 'leila.khan@northernrelay.example' },
    { name: 'Gulf Distribution', location: 'Dubai', country: 'UAE', manual_manager_name: 'Omar Haddad', manual_manager_phone: '+971 4 555 0131', manual_manager_email: 'omar.haddad@gulfdistribution.example' },
  ];

  const suppliers = [
    { supplier_code: 'SUP-ALPHA01', name: 'Quantum Components', email: 'hello@quantumcomponents.com', phone: '+1 408 555 0121', country: 'USA' },
    { supplier_code: 'SUP-ALPHA02', name: 'Nebula Logistics', email: 'team@nebulalogistics.com', phone: '+44 20 5550 1031', country: 'United Kingdom' },
    { supplier_code: 'SUP-ALPHA03', name: 'Solar Systems MFG', email: 'sales@solarsystemsmfg.com', phone: '+49 30 5550 2190', country: 'Germany' },
    { supplier_code: 'SUP-ALPHA04', name: 'Titan Hardware', email: 'contact@titanhardware.com', phone: '+81 3 5550 4482', country: 'Japan' },
    { supplier_code: 'SUP-ALPHA05', name: 'Aura Electronics', email: 'orders@auraelectronics.com', phone: '+65 6555 2019', country: 'Singapore' },
    { supplier_code: 'SUP-ALPHA06', name: 'Vertex Mobility', email: 'support@vertexmobility.com', phone: '+971 50 555 8110', country: 'UAE' },
  ];

  const brands = [
    { name: 'Chronos', country_of_origin: 'Switzerland', logo_url: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&q=80&w=300', status: 'active' },
    { name: 'Aether', country_of_origin: 'Sweden', logo_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=300', status: 'active' },
    { name: 'Hyperion', country_of_origin: 'USA', logo_url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&q=80&w=300', status: 'active' },
    { name: 'Gaia', country_of_origin: 'Denmark', logo_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=300', status: 'active' },
  ];

  const categories = [
    { name: 'Computing' },
    { name: 'Audio' },
    { name: 'Displays' },
    { name: 'Networking' },
    { name: 'Accessories' },
  ];

  const clients = [
    { client_code: 'CLI-5001', name: 'Northstar Studios', email: 'ops@northstarstudios.com', phone: '+1 646 555 1021', location: 'New York, USA', status: 'active' },
    { client_code: 'CLI-5002', name: 'Atlas Retail Group', email: 'purchasing@atlasretail.com', phone: '+1 213 555 2022', location: 'Los Angeles, USA', status: 'active' },
    { client_code: 'CLI-5003', name: 'Bluewave Systems', email: 'procurement@bluewavesystems.com', phone: '+44 20 5550 8892', location: 'London, UK', status: 'active' },
    { client_code: 'CLI-5004', name: 'Orbit Media House', email: 'finance@orbitmediahouse.com', phone: '+971 4 555 2201', location: 'Dubai, UAE', status: 'active' },
  ];

  const products = [
    {
      name: 'Chronos Webcam Pro',
      sku: 'CHR-WEB-PRO',
      brand: 'Chronos',
      category: 'Displays',
      supplier: 'Quantum Components',
      description: '4K studio webcam with AI framing, dual beam microphones, and low-light correction.',
      image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'V2-267TCA', barcode: '14263500694', color: 'Graphite', size: '4K', reorder_threshold: 18, unit_cost: 74, unit_price: 129, photo_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'V2-267TCB', barcode: '14263500695', color: 'Silver', size: '4K', reorder_threshold: 14, unit_cost: 79, unit_price: 139, photo_url: 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&q=80&w=500' },
      ],
    },
    {
      name: 'Aether Studio Headphones',
      sku: 'AET-AUD-710',
      brand: 'Aether',
      category: 'Audio',
      supplier: 'Aura Electronics',
      description: 'Closed-back reference headphones tuned for monitoring and content production.',
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'AET-HP-BLK', barcode: '22063500691', color: 'Black', size: 'Standard', reorder_threshold: 20, unit_cost: 92, unit_price: 169, photo_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'AET-HP-SND', barcode: '22063500692', color: 'Sand', size: 'Standard', reorder_threshold: 16, unit_cost: 96, unit_price: 175, photo_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=500' },
      ],
    },
    {
      name: 'Hyperion Dock X9',
      sku: 'HYP-DOCK-X9',
      brand: 'Hyperion',
      category: 'Computing',
      supplier: 'Vertex Mobility',
      description: 'Thunderbolt docking station with triple display support and 2.5Gb ethernet.',
      image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'HYP-DOCK-GRY', barcode: '33063500691', color: 'Graphite', size: '12-port', reorder_threshold: 12, unit_cost: 138, unit_price: 239, photo_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'HYP-DOCK-WHT', barcode: '33063500692', color: 'White', size: '12-port', reorder_threshold: 10, unit_cost: 142, unit_price: 245, photo_url: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&q=80&w=500' },
      ],
    },
    {
      name: 'Gaia Mesh Router',
      sku: 'GAI-MESH-6',
      brand: 'Gaia',
      category: 'Networking',
      supplier: 'Nebula Logistics',
      description: 'Wi-Fi 6 mesh router for multi-floor deployments with app-based diagnostics.',
      image_url: 'https://images.unsplash.com/photo-1647427060118-4911c9821b82?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'GAI-MESH-WHT', barcode: '44063500691', color: 'White', size: '2-pack', reorder_threshold: 9, unit_cost: 124, unit_price: 219, photo_url: 'https://images.unsplash.com/photo-1647427060118-4911c9821b82?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'GAI-MESH-BLK', barcode: '44063500692', color: 'Black', size: '3-pack', reorder_threshold: 7, unit_cost: 176, unit_price: 299, photo_url: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&q=80&w=500' },
      ],
    },
    {
      name: 'Chronos Creator Monitor',
      sku: 'CHR-MON-27',
      brand: 'Chronos',
      category: 'Displays',
      supplier: 'Titan Hardware',
      description: '27-inch creator monitor with 98% DCI-P3 coverage and USB-C power delivery.',
      image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'CHR-MON-27Q', barcode: '55063500691', color: 'Black', size: '27-inch', reorder_threshold: 8, unit_cost: 248, unit_price: 399, photo_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'CHR-MON-32Q', barcode: '55063500692', color: 'Black', size: '32-inch', reorder_threshold: 6, unit_cost: 312, unit_price: 489, photo_url: 'https://images.unsplash.com/photo-1527443195645-1133f7f28990?auto=format&fit=crop&q=80&w=500' },
      ],
    },
    {
      name: 'Aether Travel Keyboard',
      sku: 'AET-KEY-TRV',
      brand: 'Aether',
      category: 'Accessories',
      supplier: 'Solar Systems MFG',
      description: 'Compact low-profile wireless keyboard built for mobile teams and hybrid desks.',
      image_url: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=500',
      variants: [
        { variant_code: 'AET-KEY-GRY', barcode: '66063500691', color: 'Gray', size: '75%', reorder_threshold: 22, unit_cost: 48, unit_price: 89, photo_url: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=500' },
        { variant_code: 'AET-KEY-NVY', barcode: '66063500692', color: 'Navy', size: '75%', reorder_threshold: 18, unit_cost: 52, unit_price: 95, photo_url: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&q=80&w=500' },
      ],
    },
  ];

  const warehouseRefs: Record<string, string> = {};
  for (const warehouse of warehouses) {
    const document = await addDoc(collection(db, 'warehouses'), {
      ...warehouse,
      status: 'active',
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });
    warehouseRefs[warehouse.name] = document.id;
  }

  const supplierRefs: Record<string, string> = {};
  for (const supplier of suppliers) {
    const document = await addDoc(collection(db, 'suppliers'), {
      ...supplier,
      contact_info: supplier.email,
      status: 'active',
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });
    supplierRefs[supplier.name] = document.id;
  }

  const brandRefs: Record<string, string> = {};
  for (const brand of brands) {
    const document = await addDoc(collection(db, 'brands'), {
      ...brand,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });
    brandRefs[brand.name] = document.id;
  }

  const categoryRefs: Record<string, string> = {};
  for (const category of categories) {
    const document = await addDoc(collection(db, 'categories'), {
      ...category,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });
    categoryRefs[category.name] = document.id;
  }

  const clientRefs: string[] = [];
  for (const client of clients) {
    const document = await addDoc(collection(db, 'clients'), {
      ...client,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });
    clientRefs.push(document.id);
  }

  const variantRefs: { id: string; productName: string; supplierId: string }[] = [];
  const warehouseCycle = Object.values(warehouseRefs);

  for (let productIndex = 0; productIndex < products.length; productIndex += 1) {
    const product = products[productIndex];
    const productDocument = await addDoc(collection(db, 'products'), {
      name: product.name,
      sku: product.sku,
      brand_id: brandRefs[product.brand],
      category_id: categoryRefs[product.category],
      supplier_id: supplierRefs[product.supplier],
      description: product.description,
      image_url: product.image_url,
      status: 'active',
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    });

    for (let variantIndex = 0; variantIndex < product.variants.length; variantIndex += 1) {
      const variant = product.variants[variantIndex];
      const variantDocument = await addDoc(collection(db, 'product_variants'), {
        product_id: productDocument.id,
        ...variant,
        unit_price: variant.unit_price,
        status: 'active',
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
      });

      variantRefs.push({ id: variantDocument.id, productName: product.name, supplierId: supplierRefs[product.supplier] });

      for (let warehouseOffset = 0; warehouseOffset < 2; warehouseOffset += 1) {
        const warehouseId = warehouseCycle[(productIndex + variantIndex + warehouseOffset) % warehouseCycle.length];
        const quantity = 18 + productIndex * 6 + variantIndex * 5 + warehouseOffset * 4;

        await addDoc(collection(db, 'inventory_balances'), {
          variant_id: variantDocument.id,
          warehouse_id: warehouseId,
          available_quantity: quantity,
          reserved_quantity: warehouseOffset === 0 ? 2 : 0,
          blocked_quantity: 0,
          version: 1,
          last_modified: new Date().toISOString(),
        });

        await addDoc(collection(db, 'stock_movements'), {
          variant_id: variantDocument.id,
          warehouse_id: warehouseId,
          movement_type: 'receipt',
          quantity,
          idempotency_key: `curated_big_seed_${variantDocument.id}_${warehouseId}`,
          timestamp: new Date(Date.now() - (productIndex + warehouseOffset) * 3600_000).toISOString(),
          notes: `Curated stock load for ${product.name}`,
          status: 'completed',
        });
      }
    }
  }

  for (let index = 0; index < variantRefs.length; index += 2) {
    const variant = variantRefs[index];
    const warehouseId = warehouseCycle[index % warehouseCycle.length];
    const quantity = 20 + index * 2;
    const unitCost = 45 + index * 5;

    await addDoc(collection(db, 'purchase_orders'), {
      supplier_id: variant.supplierId,
      warehouse_id: warehouseId,
      items: [{ variant_id: variant.id, quantity, unit_cost: unitCost }],
      total_amount: quantity * unitCost,
      status: index % 4 === 0 ? 'in_transit' : 'sent',
      expected_delivery_date: new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - index * 12 * 60 * 60 * 1000).toISOString(),
    });
  }

  for (let index = 0; index < 4; index += 1) {
    const variant = variantRefs[index];
    await addDoc(collection(db, 'backorders'), {
      variant_id: variant.id,
      warehouse_id: warehouseCycle[(index + 1) % warehouseCycle.length],
      quantity: 6 + index * 3,
      order_reference: `SO-BACK-CURATED-${index + 1}`,
      status: 'pending',
      created_at: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  for (let index = 0; index < 5; index += 1) {
    const variant = variantRefs[index];
    await addDoc(collection(db, 'reservations'), {
      variant_id: variant.id,
      warehouse_id: warehouseCycle[index % warehouseCycle.length],
      quantity: 2 + index,
      order_reference: `SO-RES-CURATED-${index + 1}`,
      expiry_timestamp: new Date(Date.now() + (index + 6) * 60 * 60 * 1000).toISOString(),
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }

  for (let index = 0; index < 6; index += 1) {
    const variant = variantRefs[index];
    const quantity = 3 + index;
    const unitPrice = 120 + index * 25;
    await addDoc(collection(db, 'revenue_invoices'), {
      invoice_number: `INV-CURATED-${100 + index}`,
      customer_name: clients[index % clients.length].name,
      client_id: clientRefs[index % clientRefs.length],
      items: [{ variant_id: variant.id, quantity, unit_price: unitPrice, total: quantity * unitPrice }],
      total_amount: quantity * unitPrice,
      status: index % 2 === 0 ? 'paid' : 'pending',
      warehouse_id: warehouseCycle[index % warehouseCycle.length],
      created_at: new Date(Date.now() - index * 48 * 60 * 60 * 1000).toISOString(),
    });
  }

  console.log('Curated big data seeding complete!');
}
