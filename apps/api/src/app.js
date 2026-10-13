const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { env } = require("./lib/env");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const catalogRoutes = require("./routes/catalog.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const purchasingRoutes = require("./routes/purchasing.routes");
const ordersRoutes = require("./routes/orders.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  }

  app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/purchasing", purchasingRoutes);
  app.use("/api", ordersRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
