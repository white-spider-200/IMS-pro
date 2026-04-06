import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./server/db.js";
import { createApp } from "./server/http/createApp.js";
import { startReservationExpiryWorker } from "./server/workers/reservationExpiry.worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findAvailablePort(preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(findAvailablePort(preferredPort + 1));
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
    server.listen(preferredPort, "0.0.0.0");
  });
}

async function startServer() {
  await initDb();
  console.log("[DB] PostgreSQL initialized via DATABASE_URL");

  const app = createApp();
  const httpServer = createHttpServer(app);
  const preferredPort = Number(process.env.PORT ?? "3000");
  const port = await findAvailablePort(preferredPort);

  startReservationExpiryWorker(60_000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const frontendRoot = path.resolve(__dirname, "../frontend");
    const vite = await createViteServer({
      root: frontendRoot,
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "../frontend/dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Login: admin@ims.local / admin123`);
  });
}

startServer();
