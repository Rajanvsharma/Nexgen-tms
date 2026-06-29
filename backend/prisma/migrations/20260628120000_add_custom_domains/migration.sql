-- Add custom domain support for enterprise tenants
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "carrierDomain" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_customDomain_key" ON "Organization"("customDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_carrierDomain_key" ON "Organization"("carrierDomain");
