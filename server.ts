import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, increment, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config manually to avoid import assertion issues
const firebaseConfig = JSON.parse(readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

async function findAvailablePort(preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(findAvailablePort(preferredPort + 1));
        return;
      }
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
  const app = express();
  const preferredPort = Number(process.env.PORT ?? "3000");
  const port = await findAvailablePort(preferredPort);
  const preferredHmrPort = Number(process.env.HMR_PORT ?? String(port + 1));
  const hmrPort = await findAvailablePort(preferredHmrPort);

  // Initialize Firebase on the server
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  const auth = getAuth(firebaseApp);

  // Sign in anonymously to allow the worker to operate under security rules
  let workerEnabled = false;
  try {
    const userCredential = await signInAnonymously(auth);
    console.log('[Server] Signed in anonymously for background worker. UID:', userCredential.user.uid);
    workerEnabled = true;
  } catch (error: any) {
    console.warn('[Server] Anonymous auth unavailable. Background reservation expiry worker disabled.');
    console.warn(`[Server] Firebase auth error: ${error?.code ?? 'unknown-error'}`);
  }

  // Background Worker: Reservation Expiry
  if (workerEnabled) {
    setInterval(async () => {
      try {
        const now = new Date().toISOString();
        const q = query(
          collection(db, 'reservations'),
          where('status', '==', 'active'),
          where('expiry_timestamp', '<', now)
        );
        
        try {
          const snapshot = await getDocs(q);

          if (snapshot.empty) return;

          console.log(`[Worker] Expiring ${snapshot.size} reservations...`);
          
          for (const reservationDoc of snapshot.docs) {
            const reservation = reservationDoc.data();
            const batch = writeBatch(db);

            // 1. Mark reservation as expired
            batch.update(reservationDoc.ref, { status: 'expired' });

            // 2. Restore stock
            const balanceQuery = query(
              collection(db, 'inventory_balances'),
              where('variant_id', '==', reservation.variant_id),
              where('warehouse_id', '==', reservation.warehouse_id)
            );
            
            let balanceSnapshot;
            try {
              balanceSnapshot = await getDocs(balanceQuery);
            } catch (error: any) {
              if (error.code === 'permission-denied') {
                console.error('[Worker Permission Denied] Querying balances:', {
                  uid: auth.currentUser?.uid,
                  reservationId: reservationDoc.id
                });
              }
              throw error;
            }
            
            if (!balanceSnapshot.empty) {
              const balanceDoc = balanceSnapshot.docs[0];
              batch.update(balanceDoc.ref, {
                available_quantity: increment(reservation.quantity),
                reserved_quantity: increment(-reservation.quantity),
                version: increment(1),
                last_modified: new Date().toISOString()
              });
            }

            // 3. Log movement
            const movementRef = doc(collection(db, 'stock_movements'));
            batch.set(movementRef, {
              variant_id: reservation.variant_id,
              warehouse_id: reservation.warehouse_id,
              movement_type: 'adjustment',
              quantity: reservation.quantity,
              idempotency_key: `expiry_${reservationDoc.id}`,
              source_reference: reservation.order_reference,
              timestamp: new Date().toISOString(),
              notes: `Reservation ${reservationDoc.id} expired`,
              status: 'completed'
            });

            try {
              await batch.commit();
            } catch (error: any) {
              if (error.code === 'permission-denied') {
                console.error('[Worker Permission Denied] Committing batch:', {
                  uid: auth.currentUser?.uid,
                  reservationId: reservationDoc.id
                });
              }
              throw error;
            }
          }
        } catch (error: any) {
          if (error.code === 'permission-denied') {
            console.error('[Worker Permission Denied] Querying reservations:', {
              uid: auth.currentUser?.uid,
              isAnonymous: auth.currentUser?.isAnonymous,
              now
            });
          }
          throw error;
        }
      } catch (error) {
        console.error('[Worker Error]', error);
      }
    }, 60000); // Run every 60 seconds
  }

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: hmrPort },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
