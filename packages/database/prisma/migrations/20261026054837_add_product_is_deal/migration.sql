-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isDeal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isDeal_idx" ON "Product"("isDeal");
