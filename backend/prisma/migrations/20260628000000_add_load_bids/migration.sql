-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoadBid" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LoadBid_loadId_carrierId_key" ON "LoadBid"("loadId", "carrierId");
CREATE INDEX IF NOT EXISTS "LoadBid_loadId_idx" ON "LoadBid"("loadId");
CREATE INDEX IF NOT EXISTS "LoadBid_carrierId_idx" ON "LoadBid"("carrierId");

-- AddForeignKey
ALTER TABLE "LoadBid" ADD CONSTRAINT "LoadBid_loadId_fkey"
  FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoadBid" ADD CONSTRAINT "LoadBid_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
