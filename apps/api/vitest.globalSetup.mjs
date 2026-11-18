// Runs once, before any test file starts (Vitest's globalSetup — a separate
// process from the actual test run, not a beforeAll inside it). Sweeps any
// test fixture left behind by a previous run that got killed or crashed
// before its own afterAll could clean up — see lib/testFixtureSweep.js for
// why that matters more here than in a normal test suite: this repo's tests
// run against the one shared dev database the storefront's public catalog
// API also reads from, so a leaked fixture isn't just clutter, it's live on
// the site. Dynamic import() rather than require(): the rest of apps/api is
// CJS, but this file is loaded as ESM by Vite/Vitest, and import() can load
// a CJS module's exports from ESM.
export async function setup() {
  const { sweepLeakedTestFixtures } = await import("./src/lib/testFixtureSweep.js");
  await sweepLeakedTestFixtures();
}
