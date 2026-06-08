-- CreateTable: Organization
CREATE TABLE "Organization" (
  "id"                   TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "slug"                 TEXT NOT NULL,
  "plan"                 TEXT NOT NULL DEFAULT 'trial',
  "stripeCustomerId"     TEXT,
  "stripeSubscriptionId" TEXT,
  "subscriptionStatus"   TEXT NOT NULL DEFAULT 'trialing',
  "trialEndsAt"          TIMESTAMP(3),
  "maxUsers"             INTEGER NOT NULL DEFAULT 5,
  "maxLoadsPerMonth"     INTEGER NOT NULL DEFAULT 500,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Insert the default org for all existing data
INSERT INTO "Organization" ("id", "name", "slug", "plan", "subscriptionStatus", "trialEndsAt", "createdAt", "updatedAt")
VALUES ('org_default_nexgentms', 'NexGen TMS', 'nexgentms', 'pro', 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add organizationId to User
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to Customer
ALTER TABLE "Customer" ADD COLUMN "organizationId" TEXT;
UPDATE "Customer" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "Customer" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to Carrier + change mcNumber unique to per-org
ALTER TABLE "Carrier" ADD COLUMN "organizationId" TEXT;
UPDATE "Carrier" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "Carrier" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Carrier_organizationId_idx" ON "Carrier"("organizationId");
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "Carrier_mcNumber_key";
CREATE UNIQUE INDEX "Carrier_mcNumber_organizationId_key" ON "Carrier"("mcNumber", "organizationId");

-- Add organizationId to Quote
ALTER TABLE "Quote" ADD COLUMN "organizationId" TEXT;
UPDATE "Quote" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "Quote" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Quote_organizationId_idx" ON "Quote"("organizationId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to Load
ALTER TABLE "Load" ADD COLUMN "organizationId" TEXT;
UPDATE "Load" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "Load" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Load_organizationId_idx" ON "Load"("organizationId");
ALTER TABLE "Load" ADD CONSTRAINT "Load_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to Announcement
ALTER TABLE "Announcement" ADD COLUMN "organizationId" TEXT;
UPDATE "Announcement" SET "organizationId" = 'org_default_nexgentms';
ALTER TABLE "Announcement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Announcement_organizationId_idx" ON "Announcement"("organizationId");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
