-- v1.9 persistence and trust layer.
-- Additive audit tables for observer-mode runs, approvals, events, locks,
-- and rollback snapshots. Existing workflow records are preserved.

CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'observer',
    "status" TEXT NOT NULL DEFAULT 'approval_pending',
    "planHash" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "staleReason" TEXT NOT NULL DEFAULT '',
    "stopReason" TEXT NOT NULL DEFAULT 'none',
    "duplicateOf" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decision" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATETIME NOT NULL,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExecutionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "taskId" TEXT,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExecutionLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lockKey" TEXT NOT NULL,
    "runId" TEXT,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExecutionLock_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RollbackSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "taskId" TEXT,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "targetPath" TEXT,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "restoreReference" TEXT NOT NULL,
    "restoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RollbackSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");
CREATE INDEX "Run_status_idx" ON "Run"("status");
CREATE INDEX "Run_planHash_stateHash_idx" ON "Run"("planHash", "stateHash");

CREATE UNIQUE INDEX "Approval_token_key" ON "Approval"("token");
CREATE INDEX "Approval_runId_idx" ON "Approval"("runId");
CREATE INDEX "Approval_status_idx" ON "Approval"("status");
CREATE INDEX "Approval_expiresAt_idx" ON "Approval"("expiresAt");

CREATE INDEX "ExecutionEvent_runId_idx" ON "ExecutionEvent"("runId");
CREATE INDEX "ExecutionEvent_event_idx" ON "ExecutionEvent"("event");
CREATE INDEX "ExecutionEvent_createdAt_idx" ON "ExecutionEvent"("createdAt");

CREATE UNIQUE INDEX "ExecutionLock_lockKey_key" ON "ExecutionLock"("lockKey");
CREATE INDEX "ExecutionLock_runId_idx" ON "ExecutionLock"("runId");
CREATE INDEX "ExecutionLock_status_idx" ON "ExecutionLock"("status");
CREATE INDEX "ExecutionLock_expiresAt_idx" ON "ExecutionLock"("expiresAt");

CREATE INDEX "RollbackSnapshot_runId_idx" ON "RollbackSnapshot"("runId");
CREATE INDEX "RollbackSnapshot_kind_idx" ON "RollbackSnapshot"("kind");
CREATE INDEX "RollbackSnapshot_targetId_idx" ON "RollbackSnapshot"("targetId");
CREATE INDEX "RollbackSnapshot_targetPath_idx" ON "RollbackSnapshot"("targetPath");
