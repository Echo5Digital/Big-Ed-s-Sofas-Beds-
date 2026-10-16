const { PrismaClient } = require("./generated/client");

const globalForPrisma = globalThis;

// Neon's pooled endpoint suspends its compute after a few minutes idle and
// silently closes any connections Prisma was holding open. The first query
// after that shows up as `Error in PostgreSQL connection: Error { kind:
// Closed, cause: None }` even though the query itself was fine — retrying
// once lets Prisma re-establish the connection (and Neon wake back up)
// instead of surfacing a transient infra blip as a request failure.
const RETRYABLE_MESSAGE_PATTERN = /kind:\s*Closed|Connection\s*(reset|closed)|ECONNRESET/i;
const MAX_RETRIES = 2;

function isRetryableConnectionError(error) {
  return typeof error?.message === "string" && RETRYABLE_MESSAGE_PATTERN.test(error.message);
}

function withConnectionRetry(prismaClient) {
  return prismaClient.$extends({
    query: {
      async $allOperations({ args, query }) {
        let attempt = 0;
        for (;;) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= MAX_RETRIES || !isRetryableConnectionError(error)) {
              throw error;
            }
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          }
        }
      },
    },
  });
}

const prisma =
  globalForPrisma.prismaGlobal ??
  withConnectionRetry(
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    })
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
}

module.exports = { prisma, PrismaClient };
