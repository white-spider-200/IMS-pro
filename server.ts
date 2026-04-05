import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import { initDb, getDb, getAllRows } from "./server/db.js";
import { sseHandler, broadcastCollection } from "./server/sse.js";
import { requireAuth } from "./server/auth.js";
import authRouter from "./server/routes/auth.js";
import collectionsRouter from "./server/routes/collections.js";
import inventoryRouter from "./server/routes/inventory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findAvailablePort(preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") { resolve(findAvailablePort(preferredPort + 1)); return; }
      reject(error);
    });
    server.once("listening", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
    server.listen(preferredPort, "0.0.0.0");
  });
}

async function startServer() {
  // Initialize local SQLite database + default admin user
  initDb();
  console.log('[DB] SQLite database initialized at ims-pro.db');

  const app = express();
  const preferredPort = Number(process.env.PORT ?? "3000");
  const port = await findAvailablePort(preferredPort);
  const preferredHmrPort = Number(process.env.HMR_PORT ?? String(port + 1));
  const hmrPort = await findAvailablePort(preferredHmrPort);

  app.use(express.json({ limit: '10mb' }));

  // SSE endpoint for real-time updates (replaces Firestore onSnapshot)
  app.get('/api/sse', sseHandler);

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/inventory', inventoryRouter);

  // Health check
  app.get('/api/health', (req, res) => res.json({ status: 'ok', db: 'sqlite' }));

  // Background Worker: Reservation Expiry (runs every 60 seconds)
  setInterval(() => {
    try {
      const db = getDb();
      const now = new Date().toISOString();
      const expired = db.prepare(
        `SELECT * FROM reservations WHERE status = 'active' AND expiry_timestamp < ?`
      ).all(now) as any[];

      if (expired.length === 0) return;
      console.log(`[Worker] Expiring ${expired.length} reservation(s)...`);

      for (const reservation of expired) {
        db.transaction(() => {
          db.prepare(`UPDATE reservations SET status = 'expired' WHERE id = ?`).run(reservation.id);

          const balance = db.prepare(
            `SELECT * FROM inventory_balances WHERE variant_id = ? AND warehouse_id = ?`
          ).get(reservation.variant_id, reservation.warehouse_id) as any;

          if (balance) {
            db.prepare(`
              UPDATE inventory_balances
              SET available_quantity = available_quantity + ?,
                  reserved_quantity = MAX(0, reserved_quantity - ?),
                  version = version + 1,
                  last_modified = ?
              WHERE variant_id = ? AND warehouse_id = ?
            `).run(reservation.quantity, reservation.quantity, now, reservation.variant_id, reservation.warehouse_id);
          }

          db.prepare(`
            INSERT INTO stock_movements
              (id, variant_id, warehouse_id, movement_type, quantity, idempotency_key, source_reference, notes, status, timestamp)
            VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, 'completed', ?)
          `).run(
            crypto.randomUUID(), reservation.variant_id, reservation.warehouse_id,
            reservation.quantity, `expiry_${reservation.id}`,
            reservation.order_reference, `Reservation ${reservation.id} expired`, now
          );
        })();
      }

      // Broadcast updated collections
      broadcastCollection('reservations', getAllRows('reservations'));
      broadcastCollection('inventory_balances', getAllRows('inventory_balances'));
      broadcastCollection('stock_movements', getAllRows('stock_movements'));
    } catch (error) {
      console.error('[Worker Error]', error);
    }
  }, 60_000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: hmrPort } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Login: admin@ims.local / admin123`);
  });
}

startServer();
