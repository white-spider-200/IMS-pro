import express from "express";
import { sseHandler } from "../sse.js";
import authRouter from "../modules/auth/router.js";
import collectionsRouter from "../modules/collections/router.js";
import inventoryRouter from "../modules/inventory/router.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/sse", sseHandler);
  app.use("/api/auth", authRouter);
  app.use("/api/collections", collectionsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.get("/api/health", (req, res) => res.json({ status: "ok", db: "postgres" }));

  return app;
}

