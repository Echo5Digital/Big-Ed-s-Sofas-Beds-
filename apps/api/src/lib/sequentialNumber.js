const { prisma } = require("@big-eds/database");

// Atomically increments and returns the next value for a named sequence,
// backed by the SequenceCounter table (one row per sequence key). INSERT ...
// ON CONFLICT DO UPDATE ... RETURNING is a single statement as far as
// Postgres is concerned — it takes the row lock, creates the row on first
// use or increments it on every use after, and returns the new value, all
// atomically. Two concurrent calls for the same key serialize on that row
// lock and each get a distinct value; neither can read-then-write a stale
// count the way the old count()+1 approach could. Pass `tx` to participate
// in a caller's existing transaction; omit it to run standalone.
async function nextSequenceValue(key, db = prisma) {
  const [row] = await db.$queryRaw`
    INSERT INTO "SequenceCounter" ("key", "value")
    VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "SequenceCounter"."value" + 1
    RETURNING "value"
  `;
  return row.value;
}

module.exports = { nextSequenceValue };
