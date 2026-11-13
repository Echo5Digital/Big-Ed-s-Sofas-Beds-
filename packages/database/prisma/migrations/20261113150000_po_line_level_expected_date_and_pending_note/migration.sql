-- AlterTable
ALTER TABLE "POLine" ADD COLUMN     "expectedDate" TIMESTAMP(3),
ADD COLUMN     "pendingNote" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "expectedDate";
