export const demoUser = {
  name: 'Local Demo User',
  email: 'demo@localhost',
  role: 'admin',
};

export const demoWarehouses = [
  { id: 'wh-1', name: 'Central Logistics Hub', location: 'London Heathrow', country: 'United Kingdom', manager_email: 'manager1@example.com', status: 'active' },
  { id: 'wh-2', name: 'Northern Distribution Center', location: 'Manchester', country: 'United Kingdom', manager_email: 'manager2@example.com', status: 'active' },
  { id: 'wh-3', name: 'European Gateway', location: 'Rotterdam', country: 'Netherlands', manager_email: 'hans@example.com', status: 'active' },
  { id: 'wh-4', name: 'Global Nexus', location: 'Jurong East', country: 'Singapore', manager_email: 'tak@globalnexus.sg', status: 'active' },
];

export const demoSuppliers = [
  { id: 'sup-1', name: 'Global Tech Industries', country: 'USA', contact_info: 'sales@globaltech.com', status: 'active' },
  { id: 'sup-2', name: 'EuroParts Manufacturing', country: 'Belgium', contact_info: 'info@europarts.be', status: 'active' },
  { id: 'sup-3', name: 'Asia Component Corp', country: 'Taiwan', contact_info: 'orders@asiacorp.tw', status: 'active' },
];

export const demoClients = [
  { id: 'client-1', client_code: 'CLI-001', name: 'Acme Corp', email: 'purchasing@acmecorp.com', phone: '555-0101', location: 'New York, USA', balance_due: 0, paid_amount: 0, credit_balance: 0, total_billed: 0, pending_amount: 0, balance: 0 },
  { id: 'client-2', client_code: 'CLI-002', name: 'Globex Inc', email: 'orders@globex.com', phone: '555-0202', location: 'London, UK', balance_due: 0, paid_amount: 0, credit_balance: 0, total_billed: 0, pending_amount: 0, balance: 0 },
  { id: 'client-3', client_code: 'CLI-003', name: 'Initech', email: 'procurement@initech.net', phone: '555-0303', location: 'Austin, TX', balance_due: 0, paid_amount: 0, credit_balance: 0, total_billed: 0, pending_amount: 0, balance: 0 },
];

export const demoBrands = [
  { id: 'brand-1', name: 'TechPro', country_of_origin: 'USA', status: 'active', logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=400' },
  { id: 'brand-2', name: 'EcoFlow', country_of_origin: 'Germany', status: 'active', logo_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
  { id: 'brand-3', name: 'Zenith', country_of_origin: 'Japan', status: 'active', logo_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400' },
  { id: 'brand-4', name: 'Nexus', country_of_origin: 'Singapore', status: 'active', logo_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=400' },
];

export const demoCategories = [
  { id: 'cat-1', name: 'Electronics' },
  { id: 'cat-2', name: 'Computing' },
  { id: 'cat-3', name: 'Peripherals' },
  { id: 'cat-4', name: 'Networking' },
  { id: 'cat-5', name: 'Mobile' },
  { id: 'cat-6', name: 'Smart Home' },
];

export const demoProducts = [
  { id: 'prod-1', name: 'TechPro X1 Carbon', sku: 'TP-X1-C', brand: 'TechPro', category: 'Computing', supplier: 'Global Tech Industries', image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=600', status: 'active' },
  { id: 'prod-2', name: 'EcoMouse Wireless Pro', sku: 'EM-W-PRO', brand: 'EcoFlow', category: 'Peripherals', supplier: 'EuroParts Manufacturing', image_url: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&q=80&w=600', status: 'active' },
  { id: 'prod-3', name: 'Zenith Router AX6000', sku: 'ZN-AX6000', brand: 'Zenith', category: 'Networking', supplier: 'Asia Component Corp', image_url: 'https://images.unsplash.com/photo-1647427060118-4911c9821b82?auto=format&fit=crop&q=80&w=600', status: 'active' },
  { id: 'prod-4', name: 'Nexus One Smartphone', sku: 'NX-ONE-S', brand: 'Nexus', category: 'Mobile', supplier: 'Global Tech Industries', image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600', status: 'active' },
  { id: 'prod-5', name: 'Aether Smart Bulb', sku: 'AET-BULB-RGB', brand: 'EcoFlow', category: 'Smart Home', supplier: 'EuroParts Manufacturing', image_url: 'https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&fit=crop&q=80&w=600', status: 'active' },
  { id: 'prod-6', name: 'Aether Smart Plug', sku: 'AET-PLUG-WIFI', brand: 'EcoFlow', category: 'Smart Home', supplier: 'EuroParts Manufacturing', image_url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&q=80&w=600', status: 'active' },
];

export const demoVariants = [
  { id: 'var-1', product: 'TechPro X1 Carbon', variant_code: 'X1-SILVER-16GB-512GB', barcode: '1234567890123', color: 'Silver', status: 'active' },
  { id: 'var-2', product: 'TechPro X1 Carbon', variant_code: 'X1-BLACK-32GB-1TB', barcode: '1234567890124', color: 'Matte Black', status: 'active' },
  { id: 'var-3', product: 'EcoMouse Wireless Pro', variant_code: 'EM-PRO-GRAY', barcode: '9876543210987', color: 'Space Gray', status: 'active' },
  { id: 'var-4', product: 'Zenith Router AX6000', variant_code: 'AX6000-WHITE', barcode: '4567890123456', color: 'White', status: 'active' },
  { id: 'var-5', product: 'Nexus One Smartphone', variant_code: 'NX-ONE-BLACK', barcode: '5060708090123', color: 'Phantom Black', status: 'active' },
  { id: 'var-6', product: 'Aether Smart Bulb', variant_code: 'AET-BLB-RGB', barcode: '7706350060', color: 'RGB', status: 'active' },
  { id: 'var-7', product: 'Aether Smart Plug', variant_code: 'AET-PLG-WIFI', barcode: '7706350061', color: 'White', status: 'active' },
];

export const demoInventory = [
  { id: 'inv-1', warehouse: 'Central Logistics Hub', product: 'TechPro X1 Carbon', variant: 'X1-SILVER-16GB-512GB', available: 45, reserved: 5, status: 'In Stock' },
  { id: 'inv-2', warehouse: 'Northern Distribution Center', product: 'TechPro X1 Carbon', variant: 'X1-SILVER-16GB-512GB', available: 12, reserved: 0, status: 'Low Stock' },
  { id: 'inv-3', warehouse: 'Central Logistics Hub', product: 'TechPro X1 Carbon', variant: 'X1-BLACK-32GB-1TB', available: 30, reserved: 2, status: 'In Stock' },
  { id: 'inv-4', warehouse: 'Central Logistics Hub', product: 'EcoMouse Wireless Pro', variant: 'EM-PRO-GRAY', available: 120, reserved: 20, status: 'In Stock' },
  { id: 'inv-5', warehouse: 'European Gateway', product: 'Zenith Router AX6000', variant: 'AX6000-WHITE', available: 8, reserved: 0, status: 'Low Stock' },
  { id: 'inv-6', warehouse: 'Global Nexus', product: 'Nexus One Smartphone', variant: 'NX-ONE-BLACK', available: 25, reserved: 0, status: 'In Stock' },
];

export const demoUsers = [
  { id: 'user-1', displayName: 'John Manager', email: 'manager1@example.com', role: 'manager' },
  { id: 'user-2', displayName: 'Sarah Supervisor', email: 'manager2@example.com', role: 'manager' },
  { id: 'user-3', displayName: 'Hans Visser', email: 'hans@example.com', role: 'manager' },
  { id: 'user-4', displayName: 'System Admin', email: 'admin@example.com', role: 'admin' },
];

export const demoReservations = [
  { id: 'res-1', order_reference: 'SO-2026-101', variant: 'X1-SILVER-16GB-512GB', warehouse: 'Central Logistics Hub', quantity: 5, status: 'active' },
  { id: 'res-2', order_reference: 'SO-2026-102', variant: 'EM-PRO-GRAY', warehouse: 'Central Logistics Hub', quantity: 20, status: 'active' },
];

export const demoPurchaseOrders = [
  { id: 'po-1', supplier: 'Global Tech Industries', warehouse: 'Central Logistics Hub', total_amount: '$92,000', status: 'in_transit', eta: '2026-04-04' },
  { id: 'po-2', supplier: 'Asia Component Corp', warehouse: 'European Gateway', total_amount: '$18,400', status: 'draft', eta: '2026-04-11' },
];

export const demoMovements = [
  { id: 'mov-1', timestamp: '2026-03-25 09:20', warehouse: 'Central Logistics Hub', variant: 'X1-SILVER-16GB-512GB', movement_type: 'receipt', quantity: 50, status: 'completed' },
  { id: 'mov-2', timestamp: '2026-03-25 11:10', warehouse: 'Central Logistics Hub', variant: 'EM-PRO-GRAY', movement_type: 'issue', quantity: 20, status: 'completed' },
  { id: 'mov-3', timestamp: '2026-03-26 08:40', warehouse: 'European Gateway', variant: 'AX6000-WHITE', movement_type: 'transfer_in', quantity: 15, status: 'in_transit' },
];
