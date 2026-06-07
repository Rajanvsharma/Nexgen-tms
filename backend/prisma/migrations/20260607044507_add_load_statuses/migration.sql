-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LoadStatus" ADD VALUE 'DRAFT';
ALTER TYPE "LoadStatus" ADD VALUE 'BOOKED';
ALTER TYPE "LoadStatus" ADD VALUE 'DRIVER_ON_ROUTE';
ALTER TYPE "LoadStatus" ADD VALUE 'LOADING';
ALTER TYPE "LoadStatus" ADD VALUE 'ON_ROUTE';
ALTER TYPE "LoadStatus" ADD VALUE 'UNLOADING';
ALTER TYPE "LoadStatus" ADD VALUE 'DELAYED';
ALTER TYPE "LoadStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "LoadStatus" ADD VALUE 'TONU';
ALTER TYPE "LoadStatus" ADD VALUE 'DISPUTED';
ALTER TYPE "LoadStatus" ADD VALUE 'CLAIMED';
ALTER TYPE "LoadStatus" ADD VALUE 'INVOICING';
ALTER TYPE "LoadStatus" ADD VALUE 'PAYMENTS';
ALTER TYPE "LoadStatus" ADD VALUE 'COLLECTION';
ALTER TYPE "LoadStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "LoadStatus" ADD VALUE 'COMPLETED';
