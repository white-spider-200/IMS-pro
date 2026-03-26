import { db } from '../firebase';
import { collection, addDoc, getDocs, query, limit, where, updateDoc } from 'firebase/firestore';

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
    items: [{ variant_id: v1.id, quantity: 10, unit_price: 1800, total: 18000 }],
    total_amount: 18000,
    status: 'paid',
    warehouse_id: w1.id,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  await addDoc(collection(db, 'revenue_invoices'), {
    invoice_number: 'INV-2026-0002',
    customer_name: 'Creative Agency Ltd',
    items: [{ variant_id: v3.id, quantity: 25, unit_price: 89, total: 2225 }],
    total_amount: 2225,
    status: 'pending',
    warehouse_id: w1.id,
    created_at: new Date().toISOString()
  });

  console.log('Seeding complete!');
}

export async function seedBigData() {
  console.log('Seeding big data batch...');

  // 1. More Warehouses
  const warehouseNames = ['East Coast Logistics', 'Pacific Gateway', 'Midwest Hub', 'Southern Port', 'Nordic Distribution'];
  const warehouseIds: string[] = [];
  for (const name of warehouseNames) {
    const doc = await addDoc(collection(db, 'warehouses'), {
      name,
      location: 'Various',
      country: 'Global',
      status: 'active',
      manager_name: 'Big Data Manager',
      manager_email: `manager_${name.toLowerCase().replace(/ /g, '_')}@example.com`
    });
    warehouseIds.push(doc.id);
  }

  // 2. More Suppliers
  const supplierNames = [
    'Quantum Components', 'Nebula Logistics', 'Solar Systems Mfg', 'Titan Hardware',
    'Aura Electronics', 'Vertex Solutions', 'Infinity Parts', 'Omega Distribution',
    'Prism Manufacturing', 'Nova Tech'
  ];
  const supplierIds: string[] = [];
  for (const name of supplierNames) {
    const doc = await addDoc(collection(db, 'suppliers'), {
      name,
      contact_info: `contact@${name.toLowerCase().replace(/ /g, '')}.com`,
      country: 'International',
      status: 'active',
      lead_time_days: Math.floor(Math.random() * 20) + 5
    });
    supplierIds.push(doc.id);
  }

  // 3. More Brands
  const brandNames = ['Hyperion', 'Aether', 'Chronos', 'Gaia', 'Eros'];
  const brandIds: string[] = [];
  for (const name of brandNames) {
    const doc = await addDoc(collection(db, 'brands'), {
      name,
      country_of_origin: 'Various',
      status: 'active'
    });
    brandIds.push(doc.id);
  }

  // 4. More Categories
  const categoryNames = ['Audio', 'Storage', 'Displays', 'Input Devices', 'Power'];
  const categoryIds: string[] = [];
  for (const name of categoryNames) {
    const doc = await addDoc(collection(db, 'categories'), { name });
    categoryIds.push(doc.id);
  }

  // 5. More Products & Variants
  const productTemplates = [
    { name: 'Headphones', cat: 0 }, { name: 'SSD Drive', cat: 1 }, { name: 'Monitor', cat: 2 },
    { name: 'Keyboard', cat: 3 }, { name: 'Power Bank', cat: 4 }, { name: 'Speaker', cat: 0 },
    { name: 'Flash Drive', cat: 1 }, { name: 'Webcam', cat: 2 }, { name: 'Mouse Pad', cat: 3 },
    { name: 'Cable', cat: 4 }, { name: 'Microphone', cat: 0 }, { name: 'Hard Drive', cat: 1 },
    { name: 'Projector', cat: 2 }, { name: 'Stylus', cat: 3 }, { name: 'Charger', cat: 4 }
  ];

  for (let i = 0; i < productTemplates.length; i++) {
    const template = productTemplates[i];
    const brandId = brandIds[Math.floor(Math.random() * brandIds.length)];
    const supplierId = supplierIds[Math.floor(Math.random() * supplierIds.length)];
    const categoryId = categoryIds[template.cat];

    const pDoc = await addDoc(collection(db, 'products'), {
      name: `${brandNames[Math.floor(Math.random() * brandNames.length)]} ${template.name} Pro`,
      sku: `SKU-${Math.random().toString(36).substring(7).toUpperCase()}`,
      brand_id: brandId,
      category_id: categoryId,
      supplier_id: supplierId,
      status: 'active',
      description: `High quality ${template.name} for professional use.`
    });

    // Add 2 variants per product
    for (let j = 1; j <= 2; j++) {
      const vDoc = await addDoc(collection(db, 'product_variants'), {
        product_id: pDoc.id,
        variant_code: `V-${j}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        barcode: Math.floor(Math.random() * 1000000000000).toString(),
        color: j === 1 ? 'Black' : 'White',
        size: 'Standard',
        reorder_threshold: 10 + Math.floor(Math.random() * 20),
        unit_cost: 20 + Math.floor(Math.random() * 200),
        unit_price: 50 + Math.floor(Math.random() * 500),
        status: 'active'
      });

      // Add stock in 2 random warehouses
      const shuffledWarehouses = [...warehouseIds].sort(() => 0.5 - Math.random());
      for (let k = 0; k < 2; k++) {
        const warehouseId = shuffledWarehouses[k];
        const qty = 50 + Math.floor(Math.random() * 150);

        await addDoc(collection(db, 'inventory_balances'), {
          variant_id: vDoc.id,
          warehouse_id: warehouseId,
          available_quantity: qty,
          reserved_quantity: 0,
          blocked_quantity: 0,
          version: 1,
          last_modified: new Date().toISOString()
        });

        await addDoc(collection(db, 'stock_movements'), {
          variant_id: vDoc.id,
          warehouse_id: warehouseId,
          movement_type: 'receipt',
          quantity: qty,
          idempotency_key: `big_seed_${vDoc.id}_${warehouseId}`,
          timestamp: new Date().toISOString(),
          notes: 'Bulk stock import',
          status: 'completed'
        });
      }
    }
  }

  // 6. More Purchase Orders
  console.log('Seeding POs...');
  for (let i = 0; i < 10; i++) {
    const supplierId = supplierIds[Math.floor(Math.random() * supplierIds.length)];
    const warehouseId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
    const randomProductIdx = Math.floor(Math.random() * productTemplates.length);
    // We need to find a variant for this product. This is tricky since we don't have the IDs easily.
    // Let's just pick random variants from the collection.
    const variantsSnap = await getDocs(query(collection(db, 'product_variants'), limit(20)));
    const randomVariant = variantsSnap.docs[Math.floor(Math.random() * variantsSnap.size)];
    
    if (randomVariant) {
      const qty = 50 + Math.floor(Math.random() * 100);
      const cost = 20 + Math.floor(Math.random() * 100);
      await addDoc(collection(db, 'purchase_orders'), {
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        items: [{ variant_id: randomVariant.id, quantity: qty, unit_cost: cost }],
        total_amount: qty * cost,
        status: ['sent', 'in_transit', 'received'][Math.floor(Math.random() * 3)],
        expected_delivery_date: new Date(Date.now() + (Math.random() * 10 * 24 * 60 * 60 * 1000)).toISOString(),
        created_at: new Date(Date.now() - (Math.random() * 5 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
  }

  // 7. More Revenue Invoices
  console.log('Seeding Invoices...');
  const customers = ['Tech Corp', 'Future Systems', 'Cloud Dynamics', 'Smart Solutions', 'Elite Services'];
  for (let i = 0; i < 15; i++) {
    const warehouseId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
    const variantsSnap = await getDocs(query(collection(db, 'product_variants'), limit(20)));
    const randomVariant = variantsSnap.docs[Math.floor(Math.random() * variantsSnap.size)];

    if (randomVariant) {
      const qty = 5 + Math.floor(Math.random() * 20);
      const price = 100 + Math.floor(Math.random() * 500);
      await addDoc(collection(db, 'revenue_invoices'), {
        invoice_number: `INV-BIG-${1000 + i}`,
        customer_name: customers[Math.floor(Math.random() * customers.length)],
        items: [{ variant_id: randomVariant.id, quantity: qty, unit_price: price, total: qty * price }],
        total_amount: qty * price,
        status: ['pending', 'paid'][Math.floor(Math.random() * 2)],
        warehouse_id: warehouseId,
        created_at: new Date(Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
  }

  // 8. More Backorders
  console.log('Seeding Backorders...');
  for (let i = 0; i < 5; i++) {
    const warehouseId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
    const variantsSnap = await getDocs(query(collection(db, 'product_variants'), limit(20)));
    const randomVariant = variantsSnap.docs[Math.floor(Math.random() * variantsSnap.size)];

    if (randomVariant) {
      await addDoc(collection(db, 'backorders'), {
        variant_id: randomVariant.id,
        warehouse_id: warehouseId,
        quantity: 10 + Math.floor(Math.random() * 30),
        order_reference: `SO-BACK-BIG-${i}`,
        status: 'pending',
        created_at: new Date(Date.now() - (Math.random() * 3 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
  }

  // 9. More Reservations
  console.log('Seeding Reservations...');
  for (let i = 0; i < 8; i++) {
    const warehouseId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
    const variantsSnap = await getDocs(query(collection(db, 'product_variants'), limit(20)));
    const randomVariant = variantsSnap.docs[Math.floor(Math.random() * variantsSnap.size)];

    if (randomVariant) {
      const qty = 2 + Math.floor(Math.random() * 10);
      await addDoc(collection(db, 'reservations'), {
        variant_id: randomVariant.id,
        warehouse_id: warehouseId,
        quantity: qty,
        order_reference: `SO-RES-BIG-${i}`,
        expiry_timestamp: new Date(Date.now() + (Math.random() * 48 * 60 * 60 * 1000)).toISOString(),
        status: 'active',
        created_at: new Date().toISOString()
      });
    }
  }

  console.log('Big data seeding complete!');
}
