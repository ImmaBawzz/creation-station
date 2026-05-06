-- Baseline migration for the current local-first Creation Station schema.
-- This project predates Prisma migration history; existing local databases are
-- brought in sync with `prisma db push`, while fresh databases can use this
-- baseline migration.

CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Uncategorized',
    "tags" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RAW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "potential" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "FactoryPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "requiredAssets" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "nextActions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REVIEW_PENDING',
    "revisionNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FactoryPlan_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "labels" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FactoryPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaskBlocker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "blockerTaskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskBlocker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskBlocker_blockerTaskId_fkey" FOREIGN KEY ("blockerTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaskBlocker_blockerTaskId_idx" ON "TaskBlocker"("blockerTaskId");
CREATE UNIQUE INDEX "TaskBlocker_taskId_blockerTaskId_key" ON "TaskBlocker"("taskId", "blockerTaskId");
