-- AlterEnum
ALTER TYPE "FulfillmentMethod" ADD VALUE 'IN_STORE';

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'CASHIER';

-- CreateIndex
CREATE INDEX "Register_locationId_idx" ON "Register"("locationId");

-- CreateIndex
CREATE INDEX "RegisterSession_openedById_idx" ON "RegisterSession"("openedById");

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
