-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isWarrantied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warrantyNote" TEXT;
