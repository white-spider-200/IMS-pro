import { api } from '../lib/api';

// All business logic now lives on the server (server/routes/inventory.ts).
// This service is a thin client that calls the REST API.

export const InventoryService = {
  async receiveStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    batchId: string,
    idempotencyKey: string
  ) {
    await api.post('/inventory/receive', { variantId, warehouseId, quantity, batchId, idempotencyKey });
  },

  async issueStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    customerName: string,
    idempotencyKey: string,
    options: {
      unitPrice?: number;
      clientId?: string;
      vatRate?: number;
      deliveryStatus?: string;
      deliveryAddress?: string;
      deliveryFee?: number;
      paymentAmount?: number;
      paymentNotes?: string;
      notes?: string;
      transactionTime?: string;
    } = {}
  ) {
    await api.post('/inventory/issue', {
      variantId,
      warehouseId,
      quantity,
      customerName,
      idempotencyKey,
      ...options,
    });
  },

  async transferStock(
    variantId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    idempotencyKey: string
  ) {
    await api.post('/inventory/transfer', { variantId, fromWarehouseId, toWarehouseId, quantity, idempotencyKey });
  },

  async processBuyOrder(input: {
    variantId: string;
    productId: string;
    clientId: string;
    clientName: string;
    requestedQuantity: number;
    warehouseAllocations: Array<{ warehouseId: string; quantity: number }>;
    supplierId?: string | null;
    supplierQuantity: number;
    receivingWarehouseId?: string | null;
    unitCost: number;
    vatRate: number;
    idempotencyKey: string;
  }) {
    await api.post('/inventory/buy-order', input);
  },

  async buyFromCustomer(input: {
    variantId: string;
    productId: string;
    clientId: string;
    clientName: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
    deliveryStatus?: string;
    deliveryAddress?: string;
    deliveryFee?: number;
    vatRate?: number;
    paymentAmount?: number;
    paymentNotes?: string;
    notes?: string;
    idempotencyKey: string;
    transactionTime?: string;
  }) {
    await api.post('/inventory/buy-from-customer', input);
  },

  async returnStock(input: {
    variantId: string;
    productId: string;
    clientId: string;
    clientName: string;
    warehouseId: string;
    quantity: number;
    unitAmount: number;
    returnScope: 'sale' | 'purchase';
    notes?: string;
    idempotencyKey: string;
    transactionTime?: string;
    originalInvoiceId?: string | null;
  }) {
    await api.post('/inventory/return', input);
  },
};

export default InventoryService;
