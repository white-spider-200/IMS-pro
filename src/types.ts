export type Status = 'active' | 'inactive';

export interface Warehouse {
  id?: string;
  name: string;
  location?: string;
  country?: string;
  manager_id?: string;
  status: Status;
}

export interface Supplier {
  id?: string;
  name: string;
  contact_info?: string;
  country?: string;
  status: Status;
}

export interface Brand {
  id?: string;
  name: string;
  country_of_origin?: string;
  status: Status;
}

export interface Category {
  id?: string;
  name: string;
  parent_category_id?: string;
}

export interface Product {
  id?: string;
  name: string;
  sku: string;
  brand_id?: string;
  category_id?: string;
  supplier_id?: string;
  country_of_origin?: string;
  description?: string;
  image_url?: string;
  status: Status;
}

export interface ProductVariant {
  id?: string;
  product_id: string;
  variant_code: string;
  color?: string;
  size?: string;
  type?: string;
  barcode: string;
  image_url?: string;
  attributes?: Record<string, any>;
  reorder_threshold?: number;
  unit_cost?: number;
  status: Status;
}

export interface InventoryBalance {
  id?: string;
  variant_id: string;
  warehouse_id: string;
  available_quantity: number;
  reserved_quantity: number;
  blocked_quantity: number;
  version: number;
  last_modified: string;
}

export type ReservationStatus = 'active' | 'committed' | 'expired' | 'released';

export interface Reservation {
  id?: string;
  variant_id: string;
  warehouse_id: string;
  quantity: number;
  order_reference: string;
  expiry_timestamp: string;
  status: ReservationStatus;
  created_at: string;
}

export type MovementType = 'receipt' | 'issue' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'return';
export type MovementStatus = 'pending_qc' | 'completed' | 'rejected' | 'pending_inspection';

export interface StockMovement {
  id?: string;
  variant_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  quantity: number;
  idempotency_key: string;
  source_reference?: string;
  batch_id?: string;
  user_id?: string;
  timestamp: string;
  notes?: string;
  status?: MovementStatus;
}

export type POStatus = 'draft' | 'sent' | 'in_transit' | 'received' | 'overdue';

export interface POItem {
  variant_id: string;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseOrder {
  id?: string;
  supplier_id: string;
  warehouse_id: string;
  items: POItem[];
  total_amount: number;
  status: POStatus;
  expected_delivery_date: string;
  created_at: string;
}

export interface Backorder {
  id?: string;
  variant_id: string;
  warehouse_id: string;
  quantity: number;
  order_reference: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  created_at: string;
}

export interface User {
  id?: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'manager' | 'worker';
  warehouse_ids?: string[];
  created_at: string;
}
