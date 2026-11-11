-- CreateEnum
CREATE TYPE "StoreCreditReason" AS ENUM ('ISSUED_FROM_RETURN', 'REDEEMED');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('SELLABLE', 'DAMAGED', 'QUARANTINED', 'REQUIRES_INSPECTION');

-- CreateEnum
CREATE TYPE "ReturnReasonCode" AS ENUM ('CUSTOMER_CHANGED_MIND', 'DAMAGED_PRODUCT', 'WRONG_PRODUCT', 'DEFECTIVE_PRODUCT', 'OTHER');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'STORE_CREDIT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "performedById" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "StoreCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" "StoreCreditReason" NOT NULL,
    "returnTransactionId" TEXT,
    "orderId" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "registerSessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "exchangeOrderId" TEXT,
    "totalRefundCents" INTEGER NOT NULL,
    "reasonSummary" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" TEXT NOT NULL,
    "returnTransactionId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitRefundCents" INTEGER NOT NULL,
    "condition" "ReturnCondition" NOT NULL,
    "reasonCode" "ReturnReasonCode" NOT NULL,
    "replacementVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreCredit_customerId_idx" ON "StoreCredit"("customerId");

-- CreateIndex
CREATE INDEX "StoreCredit_returnTransactionId_idx" ON "StoreCredit"("returnTransactionId");

-- CreateIndex
CREATE INDEX "StoreCredit_orderId_idx" ON "StoreCredit"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnTransaction_receiptNumber_key" ON "ReturnTransaction"("receiptNumber");

-- CreateIndex
CREATE INDEX "ReturnTransaction_orderId_idx" ON "ReturnTransaction"("orderId");

-- CreateIndex
CREATE INDEX "ReturnTransaction_registerSessionId_idx" ON "ReturnTransaction"("registerSessionId");

-- CreateIndex
CREATE INDEX "ReturnTransaction_customerId_idx" ON "ReturnTransaction"("customerId");

-- CreateIndex
CREATE INDEX "ReturnTransaction_exchangeOrderId_idx" ON "ReturnTransaction"("exchangeOrderId");

-- CreateIndex
CREATE INDEX "ReturnLine_returnTransactionId_idx" ON "ReturnLine"("returnTransactionId");

-- CreateIndex
CREATE INDEX "ReturnLine_orderLineId_idx" ON "ReturnLine"("orderLineId");

-- CreateIndex
CREATE INDEX "ReturnLine_variantId_idx" ON "ReturnLine"("variantId");

-- CreateIndex
CREATE INDEX "Payment_performedById_idx" ON "Payment"("performedById");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCredit" ADD CONSTRAINT "StoreCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCredit" ADD CONSTRAINT "StoreCredit_returnTransactionId_fkey" FOREIGN KEY ("returnTransactionId") REFERENCES "ReturnTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCredit" ADD CONSTRAINT "StoreCredit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCredit" ADD CONSTRAINT "StoreCredit_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "RegisterSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_exchangeOrderId_fkey" FOREIGN KEY ("exchangeOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_returnTransactionId_fkey" FOREIGN KEY ("returnTransactionId") REFERENCES "ReturnTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_replacementVariantId_fkey" FOREIGN KEY ("replacementVariantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
