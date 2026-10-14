import { defineConfig } from "vitest/config";

// Tests run against the real dev database (no Prisma mock layer exists in
// this repo) and share mutable rows across test files, so they must run
// sequentially in a single process rather than in parallel workers.
export default defineConfig({
  test: {
    pool: "forks",
    singleFork: true,
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
