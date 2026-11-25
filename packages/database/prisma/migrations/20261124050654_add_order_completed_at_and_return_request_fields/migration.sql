-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "isReturnRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnAttachmentPublicId" TEXT,
ADD COLUMN     "returnAttachmentUrl" TEXT,
ADD COLUMN     "returnOrderReference" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ContactMessage_isReturnRequest_idx" ON "ContactMessage"("isReturnRequest");
