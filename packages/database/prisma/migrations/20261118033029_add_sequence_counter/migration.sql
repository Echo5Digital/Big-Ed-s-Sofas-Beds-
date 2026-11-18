-- CreateTable
CREATE TABLE "SequenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("key")
);

-- Seed every counter from the highest number-column offset already issued
-- (NOT from COUNT(*) — deleted test rows leave gaps, so count() can be lower
-- than the highest offset still in use on a surviving row, which would
-- reissue and collide with it). "BE-100019" -> offset 19, "PO-1003" -> 3,
-- etc. COALESCE(..., 0) so an empty table seeds its counter at 0, same as
-- the column default, rather than erroring on an empty MAX().
INSERT INTO "SequenceCounter" ("key", "value")
SELECT 'order', COALESCE(MAX(CAST(SUBSTRING("orderNumber" FROM 'BE-([0-9]+)') AS INTEGER) - 100000), 0)
FROM "Order"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SequenceCounter" ("key", "value")
SELECT 'purchaseOrder', COALESCE(MAX(CAST(SUBSTRING("poNumber" FROM 'PO-([0-9]+)') AS INTEGER) - 1000), 0)
FROM "PurchaseOrder"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SequenceCounter" ("key", "value")
SELECT 'receipt', COALESCE(MAX(CAST(SUBSTRING("receiptNumber" FROM 'RCPT-([0-9]+)') AS INTEGER) - 100000), 0)
FROM "Receipt"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SequenceCounter" ("key", "value")
SELECT 'returnTransaction', COALESCE(MAX(CAST(SUBSTRING("receiptNumber" FROM 'RTN-([0-9]+)') AS INTEGER) - 100000), 0)
FROM "ReturnTransaction"
ON CONFLICT ("key") DO NOTHING;

-- One counter per role-prefix badge number (see apps/api/src/lib/employeeId.js).
INSERT INTO "SequenceCounter" ("key", "value")
SELECT 'employeeId:' || SUBSTRING("employeeId" FROM 1 FOR 3), MAX(CAST(SUBSTRING("employeeId" FROM 4) AS INTEGER))
FROM "User"
WHERE "employeeId" IS NOT NULL
GROUP BY SUBSTRING("employeeId" FROM 1 FOR 3)
ON CONFLICT ("key") DO NOTHING;
