-- CreateEnum
CREATE TYPE "SalesAttributionRole" AS ENUM ('SALESMAN', 'MANAGER');

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingAddressId" TEXT,
ADD COLUMN     "discountApprovedById" TEXT,
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "requestedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "shippingAddressId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "posPinHash" TEXT,
ADD COLUMN     "posPinUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderSalesAttribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SalesAttributionRole" NOT NULL,
    "splitPercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSalesAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderSalesAttribution_orderId_idx" ON "OrderSalesAttribution"("orderId");

-- CreateIndex
CREATE INDEX "OrderSalesAttribution_userId_idx" ON "OrderSalesAttribution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSalesAttribution_orderId_userId_key" ON "OrderSalesAttribution"("orderId", "userId");

-- CreateIndex
CREATE INDEX "Order_discountApprovedById_idx" ON "Order"("discountApprovedById");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountApprovedById_fkey" FOREIGN KEY ("discountApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSalesAttribution" ADD CONSTRAINT "OrderSalesAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSalesAttribution" ADD CONSTRAINT "OrderSalesAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
