-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CarrierStatus" ADD VALUE 'BLACKLISTED';
ALTER TYPE "CarrierStatus" ADD VALUE 'DNC';
ALTER TYPE "CarrierStatus" ADD VALUE 'IN_REVIEW';

-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN     "blacklistReason" TEXT,
ADD COLUMN     "contactPerson" TEXT;
