const { PrismaClient } = require("./generated/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
}

module.exports = { prisma, PrismaClient };
