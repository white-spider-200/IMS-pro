import { prisma } from "../prisma.js";
import { getAllRows, withTransaction } from "../db.js";
import { broadcastCollection } from "../sse.js";

export function startReservationExpiryWorker(intervalMs = 60_000) {
  setInterval(() => {
    void (async () => {
      try {
        const now = new Date().toISOString();
        const expired = await prisma.reservations.findMany({
          where: { status: "active", expiry_timestamp: { lt: now } },
        });

        if (expired.length === 0) return;
        console.log(`[Worker] Expiring ${expired.length} reservation(s)...`);

        for (const reservation of expired) {
          await withTransaction(async (tx) => {
            await tx.reservations.update({
              where: { id: reservation.id },
              data: { status: "expired" },
            });

            const balance = await tx.inventory_balances.findUnique({
              where: {
                variant_id_warehouse_id: {
                  variant_id: reservation.variant_id,
                  warehouse_id: reservation.warehouse_id,
                },
              },
            });

            if (balance) {
              await tx.inventory_balances.update({
                where: {
                  variant_id_warehouse_id: {
                    variant_id: reservation.variant_id,
                    warehouse_id: reservation.warehouse_id,
                  },
                },
                data: {
                  available_quantity: balance.available_quantity + reservation.quantity,
                  reserved_quantity: Math.max(0, balance.reserved_quantity - reservation.quantity),
                  version: { increment: 1 },
                  last_modified: now,
                },
              });
            }

            await tx.stock_movements.create({
              data: {
                id: crypto.randomUUID(),
                variant_id: reservation.variant_id,
                warehouse_id: reservation.warehouse_id,
                movement_type: "adjustment",
                quantity: reservation.quantity,
                idempotency_key: `expiry_${reservation.id}`,
                source_reference: reservation.order_reference,
                notes: `Reservation ${reservation.id} expired`,
                status: "completed",
                timestamp: now,
              },
            });
          });
        }

        broadcastCollection("reservations", await getAllRows("reservations"));
        broadcastCollection("inventory_balances", await getAllRows("inventory_balances"));
        broadcastCollection("stock_movements", await getAllRows("stock_movements"));
      } catch (error) {
        console.error("[Worker Error]", error);
      }
    })();
  }, intervalMs);
}

