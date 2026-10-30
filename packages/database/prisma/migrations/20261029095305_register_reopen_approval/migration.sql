-- AlterEnum
ALTER TYPE "RegisterSessionStatus" ADD VALUE 'PENDING_REOPEN_APPROVAL';

-- AlterTable
ALTER TABLE "RegisterSession" ADD COLUMN     "reopenApprovedAt" TIMESTAMP(3),
ADD COLUMN     "reopenApprovedById" TEXT,
ADD COLUMN     "reopenDenialReason" TEXT,
ADD COLUMN     "reopenDeniedAt" TIMESTAMP(3),
ADD COLUMN     "reopenRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reopenRequestedById" TEXT;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_reopenRequestedById_fkey" FOREIGN KEY ("reopenRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_reopenApprovedById_fkey" FOREIGN KEY ("reopenApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
