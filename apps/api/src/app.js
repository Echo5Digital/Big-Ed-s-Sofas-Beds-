const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { env } = require("./lib/env");
const { errorHandler } = require("./middleware/errorHandler");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const authRoutes = require("./routes/auth.routes");
const catalogRoutes = require("./routes/catalog.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const purchasingRoutes = require("./routes/purchasing.routes");
const ordersRoutes = require("./routes/orders.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const posRoutes = require("./routes/pos.routes");
const webhooksRoutes = require("./routes/webhooks.routes");

function createApp() {
  const app = express();

  fs.mkdirSync(path.join(UPLOADS_DIR, "products"), { recursive: true });

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  // Mounted before the global JSON body parser: Stripe webhook signature
  // verification needs the raw, untouched request body, not a parsed object.
  app.use("/api/webhooks", webhooksRoutes);

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  }

  app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  // Serves admin-uploaded product images saved by catalog.routes.js's local-disk
  // upload endpoint. Dev-appropriate only — see UPLOAD_DIR comment there.
  // Helmet's default same-origin Cross-Origin-Resource-Policy would block the
  // storefront/admin apps (different origins) from loading these images.
  app.use(
    "/uploads",
    (req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(UPLOADS_DIR)
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/purchasing", purchasingRoutes);
  app.use("/api", ordersRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/pos", posRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
