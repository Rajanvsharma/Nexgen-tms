-- AddColumn repVisibility to Team
ALTER TABLE "Team" ADD COLUMN "repVisibility" TEXT NOT NULL DEFAULT 'own';

-- AddColumn assignedTo to Load
ALTER TABLE "Load" ADD COLUMN "assignedTo" TEXT;

-- AddForeignKey Load.assignedTo -> User.id
ALTER TABLE "Load" ADD CONSTRAINT "Load_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex Load.assignedTo
CREATE INDEX "Load_assignedTo_idx" ON "Load"("assignedTo");

-- CreateTable LoadAuditLog
CREATE TABLE "LoadAuditLog" (
    "id"          TEXT NOT NULL,
    "loadId"      TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "fromValue"   TEXT,
    "toValue"     TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoadAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey LoadAuditLog.loadId -> Load.id
ALTER TABLE "LoadAuditLog" ADD CONSTRAINT "LoadAuditLog_loadId_fkey"
  FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey LoadAuditLog.changedById -> User.id
ALTER TABLE "LoadAuditLog" ADD CONSTRAINT "LoadAuditLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex LoadAuditLog.loadId
CREATE INDEX "LoadAuditLog_loadId_idx" ON "LoadAuditLog"("loadId");
