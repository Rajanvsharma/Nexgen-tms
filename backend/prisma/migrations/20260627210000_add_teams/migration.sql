-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEAM_MANAGER';

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;
ALTER TABLE "User" ADD COLUMN "carrierId" TEXT;

-- AlterTable Load
ALTER TABLE "Load" ADD COLUMN "teamId" TEXT;

-- AlterTable Quote
ALTER TABLE "Quote" ADD COLUMN "teamId" TEXT;

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "Load_teamId_idx" ON "Load"("teamId");
CREATE INDEX "Quote_teamId_idx" ON "Quote"("teamId");
CREATE INDEX "Customer_teamId_idx" ON "Customer"("teamId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Load" ADD CONSTRAINT "Load_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
