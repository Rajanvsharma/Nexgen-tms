-- CreateTable: ProofOfDelivery
CREATE TABLE "ProofOfDelivery" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loadId"         TEXT NOT NULL,
    "filename"       TEXT NOT NULL,
    "fileUrl"        TEXT NOT NULL,
    "fileSize"       INTEGER,
    "podType"        TEXT NOT NULL DEFAULT 'POD',
    "notes"          TEXT,
    "uploadedById"   TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Accessorial
CREATE TABLE "Accessorial" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loadId"         TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "amount"         DOUBLE PRECISION NOT NULL,
    "billTo"         TEXT NOT NULL DEFAULT 'CUSTOMER',
    "description"    TEXT,
    "approved"       BOOLEAN NOT NULL DEFAULT false,
    "createdById"    TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LoadStop
CREATE TABLE "LoadStop" (
    "id"              TEXT NOT NULL,
    "loadId"          TEXT NOT NULL,
    "sequence"        INTEGER NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'STOP',
    "city"            TEXT NOT NULL,
    "state"           TEXT NOT NULL,
    "address"         TEXT,
    "zipCode"         TEXT,
    "contactName"     TEXT,
    "contactPhone"    TEXT,
    "appointmentDate" TIMESTAMP(3),
    "notes"           TEXT,
    "completedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProofOfDelivery_loadId_idx" ON "ProofOfDelivery"("loadId");
CREATE INDEX "ProofOfDelivery_organizationId_idx" ON "ProofOfDelivery"("organizationId");
CREATE INDEX "Accessorial_loadId_idx" ON "Accessorial"("loadId");
CREATE INDEX "Accessorial_organizationId_idx" ON "Accessorial"("organizationId");
CREATE INDEX "LoadStop_loadId_idx" ON "LoadStop"("loadId");

-- AddForeignKey: ProofOfDelivery
ALTER TABLE "ProofOfDelivery"
    ADD CONSTRAINT "ProofOfDelivery_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery"
    ADD CONSTRAINT "ProofOfDelivery_loadId_fkey"
    FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery"
    ADD CONSTRAINT "ProofOfDelivery_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Accessorial
ALTER TABLE "Accessorial"
    ADD CONSTRAINT "Accessorial_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Accessorial"
    ADD CONSTRAINT "Accessorial_loadId_fkey"
    FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Accessorial"
    ADD CONSTRAINT "Accessorial_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: LoadStop
ALTER TABLE "LoadStop"
    ADD CONSTRAINT "LoadStop_loadId_fkey"
    FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;
