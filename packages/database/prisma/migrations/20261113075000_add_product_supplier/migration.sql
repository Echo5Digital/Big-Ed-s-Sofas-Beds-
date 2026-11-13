-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every product that existed before this migration was bought from
-- Happy Homes. Matched by trimmed name (the live row is stored as
-- "Happy Homes " with a trailing space) rather than a hard-coded id so the
-- migration stays portable — on a fresh/test database with no such supplier the
-- subquery is NULL and this updates nothing.
UPDATE "Product"
SET "supplierId" = (
  SELECT "id" FROM "Supplier"
  WHERE btrim("name") = 'Happy Homes'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "supplierId" IS NULL;
