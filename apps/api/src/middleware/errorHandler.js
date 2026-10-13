const { ApiError } = require("../lib/errors");

// Centralized error handler — must be registered last. Never leaks stack
// traces or raw Prisma error internals to clients in production.
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details ?? undefined },
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({
      error: { message: "A record with this unique value already exists.", details: err.meta },
    });
  }

  if (err?.code === "P2025") {
    return res.status(404).json({ error: { message: "Record not found." } });
  }

  console.error(err);
  const isDev = process.env.NODE_ENV === "development";
  return res.status(500).json({
    error: { message: "Internal server error", stack: isDev ? err.stack : undefined },
  });
}

module.exports = { errorHandler };
