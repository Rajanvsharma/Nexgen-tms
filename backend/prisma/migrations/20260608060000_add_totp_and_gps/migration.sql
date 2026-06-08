-- AlterTable: Add TOTP fields to User
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add GPS tracking fields to Load
ALTER TABLE "Load" ADD COLUMN "trackingLat" DOUBLE PRECISION,
ADD COLUMN "trackingLng" DOUBLE PRECISION,
ADD COLUMN "trackingUpdatedAt" TIMESTAMP(3),
ADD COLUMN "trackingHistory" JSONB;
