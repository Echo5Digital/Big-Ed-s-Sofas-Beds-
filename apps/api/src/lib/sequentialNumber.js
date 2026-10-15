// Human-readable sequence numbers (order/PO/receipt numbers) are generated
// as count()+1, which is not atomic — two concurrent creates can read the
// same count and collide on the unique number column. Rather than serialize
// all creates behind a lock (which would throttle unrelated concurrent
// sales/orders), retry the whole generate-and-create step on exactly that
// collision: the retry re-reads a fresh count, so it converges quickly
// without blocking anything that isn't actually colliding.
const MAX_ATTEMPTS = 5;

async function createWithSequentialNumber(createFn) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await createFn();
    } catch (err) {
      if (err?.code === "P2002") {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

module.exports = { createWithSequentialNumber };
