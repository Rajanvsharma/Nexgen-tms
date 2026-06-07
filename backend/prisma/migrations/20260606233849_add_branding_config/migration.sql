-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL,
    "domain" TEXT,
    "companyName" TEXT NOT NULL DEFAULT 'NexGen TMS',
    "tagline" TEXT NOT NULL DEFAULT 'Transportation Management System',
    "logoData" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "darkColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    "sidebarBg" TEXT NOT NULL DEFAULT '#0d1b2a',
    "accentColor" TEXT NOT NULL DEFAULT '#22c55e',
    "plan" TEXT NOT NULL DEFAULT 'enterprise',
    "planExpiresAt" TIMESTAMP(3),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingConfig_domain_key" ON "BrandingConfig"("domain");
