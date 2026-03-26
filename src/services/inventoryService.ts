import { 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction, 
  doc, 
  serverTimestamp, 
  increment,
  addDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { InventoryBalance, Reservation, StockMovement, MovementType, ReservationStatus } from '../types';

export const InventoryService = {
  async checkAvailability(variantId: string, warehouseId: string, quantity: number): Promise<boolean> {
    const q = query(
      collection(db, 'inventory_balances'),
      where('variant_id', '==', variantId),
      where('warehouse_id', '==', warehouseId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    const balance = snapshot.docs[0].data() as InventoryBalance;
    return balance.available_quantity >= quantity;
  },

  async reserveStock(variantId: string, warehouseId: string, quantity: number, orderRef: string, ttlSeconds: number = 900) {
    return await runTransaction(db, async (transaction) => {
      const q = query(
        collection(db, 'inventory_balances'),
        where('variant_id', '==', variantId),
        where('warehouse_id', '==', warehouseId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('Inventory record not found');
      
      const balanceDoc = snapshot.docs[0];
      const balance = balanceDoc.data() as InventoryBalance;

      if (balance.available_quantity < quantity) {
        throw new Error('Insufficient stock');
      }

      // 1. Update balance
      transaction.update(balanceDoc.ref, {
        available_quantity: increment(-quantity),
        reserved_quantity: increment(quantity),
        version: increment(1),
        last_modified: new Date().toISOString()
      });

      // 2. Create reservation
      const reservationRef = doc(collection(db, 'reservations'));
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + ttlSeconds);

      transaction.set(reservationRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        quantity,
        order_reference: orderRef,
        expiry_timestamp: expiry.toISOString(),
        status: 'active',
        created_at: new Date().toISOString()
      });

      return reservationRef.id;
    });
  },

  async commitReservation(reservationId: string) {
    return await runTransaction(db, async (transaction) => {
      const resRef = doc(db, 'reservations', reservationId);
      const resSnap = await transaction.get(resRef);
      if (!resSnap.exists()) throw new Error('Reservation not found');
      
      const reservation = resSnap.data() as Reservation;
      if (reservation.status !== 'active') throw new Error('Reservation is not active');

      // 1. Update balance
      const q = query(
        collection(db, 'inventory_balances'),
        where('variant_id', '==', reservation.variant_id),
        where('warehouse_id', '==', reservation.warehouse_id)
      );
      const balanceSnapshot = await getDocs(q);
      if (balanceSnapshot.empty) throw new Error('Inventory record not found');
      
      const balanceDoc = balanceSnapshot.docs[0];
      transaction.update(balanceDoc.ref, {
        reserved_quantity: increment(-reservation.quantity),
        version: increment(1),
        last_modified: new Date().toISOString()
      });

      // 2. Log movement
      const movementRef = doc(collection(db, 'stock_movements'));
      transaction.set(movementRef, {
        variant_id: reservation.variant_id,
        warehouse_id: reservation.warehouse_id,
        movement_type: 'issue',
        quantity: reservation.quantity,
        idempotency_key: `commit_${reservationId}`,
        source_reference: reservation.order_reference,
        user_id: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        notes: `Committed reservation ${reservationId}`,
        status: 'completed'
      });

      // 3. Update reservation status
      transaction.update(resRef, { status: 'committed' });
    });
  },

  async receiveStock(variantId: string, warehouseId: string, quantity: number, batchId: string, idempotencyKey: string) {
    return await runTransaction(db, async (transaction) => {
      // 1. Check if movement already exists (idempotency)
      const qMovement = query(collection(db, 'stock_movements'), where('idempotency_key', '==', idempotencyKey));
      const movementSnap = await getDocs(qMovement);
      if (!movementSnap.empty) return movementSnap.docs[0].id;

      // 2. Update balance
      const qBalance = query(
        collection(db, 'inventory_balances'),
        where('variant_id', '==', variantId),
        where('warehouse_id', '==', warehouseId)
      );
      const balanceSnapshot = await getDocs(qBalance);
      
      if (balanceSnapshot.empty) {
        const balanceRef = doc(collection(db, 'inventory_balances'));
        transaction.set(balanceRef, {
          variant_id: variantId,
          warehouse_id: warehouseId,
          available_quantity: quantity,
          reserved_quantity: 0,
          blocked_quantity: 0,
          version: 1,
          last_modified: new Date().toISOString()
        });
      } else {
        const balanceDoc = balanceSnapshot.docs[0];
        transaction.update(balanceDoc.ref, {
          available_quantity: increment(quantity),
          version: increment(1),
          last_modified: new Date().toISOString()
        });
      }

      // 3. Log movement
      const movementRef = doc(collection(db, 'stock_movements'));
      transaction.set(movementRef, {
        variant_id: variantId,
        warehouse_id: warehouseId,
        movement_type: 'receipt',
        quantity,
        idempotency_key: idempotencyKey,
        batch_id: batchId,
        user_id: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        notes: `Received stock from batch ${batchId}`,
        status: 'completed'
      });

      return movementRef.id;
    });
  },

  async transferStock(variantId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, idempotencyKey: string) {
    return await runTransaction(db, async (transaction) => {
      // 1. Idempotency check
      const qMovement = query(collection(db, 'stock_movements'), where('idempotency_key', '==', idempotencyKey));
      const movementSnap = await getDocs(qMovement);
      if (!movementSnap.empty) return;

      // 2. Deduct from source
      const qFrom = query(
        collection(db, 'inventory_balances'),
        where('variant_id', '==', variantId),
        where('warehouse_id', '==', fromWarehouseId)
      );
      const fromSnap = await getDocs(qFrom);
      if (fromSnap.empty) throw new Error('Source inventory record not found');
      
      const fromDoc = fromSnap.docs[0];
      const fromBalance = fromDoc.data() as InventoryBalance;
      if (fromBalance.available_quantity < quantity) throw new Error('Insufficient stock in source warehouse');

      transaction.update(fromDoc.ref, {
        available_quantity: increment(-quantity),
        version: increment(1),
        last_modified: new Date().toISOString()
      });

      // 3. Add to destination
      const qTo = query(
        collection(db, 'inventory_balances'),
        where('variant_id', '==', variantId),
        where('warehouse_id', '==', toWarehouseId)
      );
      const toSnap = await getDocs(qTo);
      
      if (toSnap.empty) {
        const toRef = doc(collection(db, 'inventory_balances'));
        transaction.set(toRef, {
          variant_id: variantId,
          warehouse_id: toWarehouseId,
          available_quantity: quantity,
          reserved_quantity: 0,
          blocked_quantity: 0,
          version: 1,
          last_modified: new Date().toISOString()
        });
      } else {
        const toDoc = toSnap.docs[0];
        transaction.update(toDoc.ref, {
          available_quantity: increment(quantity),
          version: increment(1),
          last_modified: new Date().toISOString()
        });
      }

      // 4. Log movements
      const outRef = doc(collection(db, 'stock_movements'));
      transaction.set(outRef, {
        variant_id: variantId,
        warehouse_id: fromWarehouseId,
        movement_type: 'transfer_out',
        quantity,
        idempotency_key: `${idempotencyKey}_out`,
        user_id: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        notes: `Transfer to ${toWarehouseId}`,
        status: 'completed'
      });

      const inRef = doc(collection(db, 'stock_movements'));
      transaction.set(inRef, {
        variant_id: variantId,
        warehouse_id: toWarehouseId,
        movement_type: 'transfer_in',
        quantity,
        idempotency_key: `${idempotencyKey}_in`,
        user_id: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        notes: `Transfer from ${fromWarehouseId}`,
        status: 'completed'
      });
    });
  }
};
