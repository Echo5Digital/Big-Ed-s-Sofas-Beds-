const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { env } = require("./lib/env");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const customerAuthRoutes = require("./routes/customerAuth.routes");
const customerAccountRoutes = require("./routes/customerAccount.routes");
const usersRoutes = require("./routes/users.routes");
const catalogRoutes = require("./routes/catalog.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const purchasingRoutes = require("./routes/purchasing.routes");
const ordersRoutes = require("./routes/orders.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const posRoutes = require("./routes/pos.routes");
const reportsRoutes = require("./routes/reports.routes");
const webhooksRoutes = require("./routes/webhooks.routes");

function createApp() {
  const app = express();

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

  app.use("/api/auth", authRoutes);
  app.use("/api/customer-auth", customerAuthRoutes);
  app.use("/api/customer-account", customerAccountRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/purchasing", purchasingRoutes);
  app.use("/api", ordersRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/pos", posRoutes);
  app.use("/api/reports", reportsRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
