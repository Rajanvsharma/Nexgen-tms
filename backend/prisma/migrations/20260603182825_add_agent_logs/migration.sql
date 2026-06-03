-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "summary" TEXT,
    "findings" INTEGER NOT NULL DEFAULT 0,
    "actions" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);
