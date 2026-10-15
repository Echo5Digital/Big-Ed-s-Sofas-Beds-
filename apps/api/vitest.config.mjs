import { defineConfig } from "vitest/config";

// Tests run against the real dev database (no Prisma mock layer exists in
// this repo) and share mutable rows (e.g. count-based order/receipt/PO
// numbers) across test files, so test FILES must run sequentially, not just
// inside a single process. `singleFork` alone only prevents multiple OS
// processes — Vitest still interleaves separate test files' suites
// concurrently within that one process by default (`fileParallelism`
// defaults to true), which let two files' order-creating tests race on the
// same count()+1 sequence number. `fileParallelism: false` forces true
// file-by-file sequential execution.
export default defineConfig({
  test: {
    pool: "forks",
    singleFork: true,
    fileParallelism: false,
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
