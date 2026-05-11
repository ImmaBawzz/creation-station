import Database from "better-sqlite3";
import { isAbsolute, resolve } from "node:path";
import { mkdirSync } from "node:fs";

function resolveSqliteFilePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Playwright database setup requires a file: SQLite DATABASE_URL.");
  }

  const localPath = databaseUrl.slice("file:".length);

  if (!localPath) {
    throw new Error("Playwright database setup received an empty SQLite path.");
  }

  const normalizedPath = localPath.startsWith("./")
    ? localPath.slice(2)
    : localPath;

  if (
    isAbsolute(normalizedPath) ||
    normalizedPath.includes("/") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("..") ||
    !/^playwright\.e2e\.[A-Za-z0-9_-]+\.db$/.test(normalizedPath)
  ) {
    throw new Error(
      "Playwright database setup only accepts workspace-local file:./playwright.e2e.<id>.db SQLite URLs.",
    );
  }

  return resolve(process.cwd(), normalizedPath);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Playwright database setup.");
}

const databaseFilePath = resolveSqliteFilePath(databaseUrl);
mkdirSync(process.cwd(), { recursive: true });

const db = new Database(databaseFilePath);

try {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "Idea" (
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

    CREATE TABLE IF NOT EXISTS "Run" (
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

    CREATE TABLE IF NOT EXISTS "Approval" (
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

    CREATE TABLE IF NOT EXISTS "ExecutionEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "runId" TEXT NOT NULL,
      "taskId" TEXT,
      "event" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExecutionEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ExecutionLock" (
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

    CREATE TABLE IF NOT EXISTS "RollbackSnapshot" (
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

    CREATE TABLE IF NOT EXISTS "execution_requests" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "task_id" TEXT NOT NULL,
      "action_type" TEXT NOT NULL,
      "payload" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "approval_status" TEXT NOT NULL DEFAULT 'approved',
      "rollback_snapshot_id" TEXT,
      "rollback_payload" TEXT NOT NULL DEFAULT '',
      "execution_hash" TEXT NOT NULL,
      "worker_id" TEXT,
      "retry_count" INTEGER NOT NULL DEFAULT 0,
      "max_retries" INTEGER NOT NULL DEFAULT 2,
      "result" TEXT NOT NULL DEFAULT '',
      "error" TEXT NOT NULL DEFAULT '',
      "audit_log" TEXT NOT NULL DEFAULT '[]',
      "claimed_at" DATETIME,
      "completed_at" DATETIME,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "execution_workers" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "action_type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'idle',
      "health_state" TEXT NOT NULL DEFAULT 'healthy',
      "last_heartbeat_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "current_request_id" TEXT,
      "processed_count" INTEGER NOT NULL DEFAULT 0,
      "failed_count" INTEGER NOT NULL DEFAULT 0,
      "stale_recovered_count" INTEGER NOT NULL DEFAULT 0,
      "shutdown_requested" BOOLEAN NOT NULL DEFAULT false,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "stopped_at" DATETIME,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "FactoryPlan" (
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

    CREATE TABLE IF NOT EXISTS "ActivityEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventType" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "metadata" JSONB,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Task" (
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

    CREATE TABLE IF NOT EXISTS "TaskBlocker" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "taskId" TEXT NOT NULL,
      "blockerTaskId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TaskBlocker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TaskBlocker_blockerTaskId_fkey" FOREIGN KEY ("blockerTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ContentItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "coreIdea" TEXT NOT NULL,
      "audience" TEXT NOT NULL DEFAULT '',
      "format" TEXT NOT NULL DEFAULT 'SHORT_VIDEO',
      "primaryPlatform" TEXT NOT NULL DEFAULT 'YOUTUBE',
      "status" TEXT NOT NULL DEFAULT 'IDEA',
      "tags" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ContentBrief" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contentItemId" TEXT NOT NULL,
      "objective" TEXT NOT NULL DEFAULT '',
      "angle" TEXT NOT NULL DEFAULT '',
      "promise" TEXT NOT NULL DEFAULT '',
      "outline" TEXT NOT NULL DEFAULT '',
      "cta" TEXT NOT NULL DEFAULT '',
      "keywords" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ContentBrief_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ContentDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contentItemId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ContentDraft_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "PublishingTarget" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contentItemId" TEXT NOT NULL,
      "platform" TEXT NOT NULL,
      "caption" TEXT NOT NULL DEFAULT '',
      "hashtags" TEXT NOT NULL DEFAULT '',
      "checklist" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'PREP',
      "scheduledAt" DATETIME,
      "publishedAt" DATETIME,
      "publishUrl" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PublishingTarget_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ContentMetric" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contentItemId" TEXT NOT NULL,
      "platform" TEXT NOT NULL,
      "views" INTEGER NOT NULL DEFAULT 0,
      "likes" INTEGER NOT NULL DEFAULT 0,
      "comments" INTEGER NOT NULL DEFAULT 0,
      "shares" INTEGER NOT NULL DEFAULT 0,
      "saves" INTEGER NOT NULL DEFAULT 0,
      "clicks" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT NOT NULL DEFAULT '',
      "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContentMetric_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "MonetizationLink" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contentItemId" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "offerName" TEXT NOT NULL DEFAULT '',
      "offerUrl" TEXT NOT NULL DEFAULT '',
      "expectedValueCents" INTEGER NOT NULL DEFAULT 0,
      "actualRevenueCents" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "MonetizationLink_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "Run_createdAt_idx" ON "Run"("createdAt");
    CREATE INDEX IF NOT EXISTS "Run_status_idx" ON "Run"("status");
    CREATE INDEX IF NOT EXISTS "Run_planHash_stateHash_idx" ON "Run"("planHash", "stateHash");
    CREATE UNIQUE INDEX IF NOT EXISTS "Approval_token_key" ON "Approval"("token");
    CREATE INDEX IF NOT EXISTS "Approval_runId_idx" ON "Approval"("runId");
    CREATE INDEX IF NOT EXISTS "Approval_status_idx" ON "Approval"("status");
    CREATE INDEX IF NOT EXISTS "Approval_expiresAt_idx" ON "Approval"("expiresAt");
    CREATE INDEX IF NOT EXISTS "ExecutionEvent_runId_idx" ON "ExecutionEvent"("runId");
    CREATE INDEX IF NOT EXISTS "ExecutionEvent_event_idx" ON "ExecutionEvent"("event");
    CREATE INDEX IF NOT EXISTS "ExecutionEvent_createdAt_idx" ON "ExecutionEvent"("createdAt");
    CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionLock_lockKey_key" ON "ExecutionLock"("lockKey");
    CREATE INDEX IF NOT EXISTS "ExecutionLock_runId_idx" ON "ExecutionLock"("runId");
    CREATE INDEX IF NOT EXISTS "ExecutionLock_status_idx" ON "ExecutionLock"("status");
    CREATE INDEX IF NOT EXISTS "ExecutionLock_expiresAt_idx" ON "ExecutionLock"("expiresAt");
    CREATE INDEX IF NOT EXISTS "RollbackSnapshot_runId_idx" ON "RollbackSnapshot"("runId");
    CREATE INDEX IF NOT EXISTS "RollbackSnapshot_kind_idx" ON "RollbackSnapshot"("kind");
    CREATE INDEX IF NOT EXISTS "RollbackSnapshot_targetId_idx" ON "RollbackSnapshot"("targetId");
    CREATE INDEX IF NOT EXISTS "RollbackSnapshot_targetPath_idx" ON "RollbackSnapshot"("targetPath");
    CREATE UNIQUE INDEX IF NOT EXISTS "execution_requests_execution_hash_key" ON "execution_requests"("execution_hash");
    CREATE INDEX IF NOT EXISTS "execution_requests_status_idx" ON "execution_requests"("status");
    CREATE INDEX IF NOT EXISTS "execution_requests_approval_status_idx" ON "execution_requests"("approval_status");
    CREATE INDEX IF NOT EXISTS "execution_requests_worker_id_idx" ON "execution_requests"("worker_id");
    CREATE INDEX IF NOT EXISTS "execution_requests_created_at_idx" ON "execution_requests"("created_at");
    CREATE INDEX IF NOT EXISTS "execution_workers_action_type_idx" ON "execution_workers"("action_type");
    CREATE INDEX IF NOT EXISTS "execution_workers_status_idx" ON "execution_workers"("status");
    CREATE INDEX IF NOT EXISTS "execution_workers_health_state_idx" ON "execution_workers"("health_state");
    CREATE INDEX IF NOT EXISTS "execution_workers_last_heartbeat_at_idx" ON "execution_workers"("last_heartbeat_at");
    CREATE INDEX IF NOT EXISTS "ActivityEvent_eventType_idx" ON "ActivityEvent"("eventType");
    CREATE INDEX IF NOT EXISTS "ActivityEvent_entityType_idx" ON "ActivityEvent"("entityType");
    CREATE INDEX IF NOT EXISTS "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
    CREATE INDEX IF NOT EXISTS "TaskBlocker_blockerTaskId_idx" ON "TaskBlocker"("blockerTaskId");
    CREATE UNIQUE INDEX IF NOT EXISTS "TaskBlocker_taskId_blockerTaskId_key" ON "TaskBlocker"("taskId", "blockerTaskId");
    CREATE INDEX IF NOT EXISTS "ContentItem_status_idx" ON "ContentItem"("status");
    CREATE INDEX IF NOT EXISTS "ContentItem_primaryPlatform_idx" ON "ContentItem"("primaryPlatform");
    CREATE INDEX IF NOT EXISTS "ContentItem_createdAt_idx" ON "ContentItem"("createdAt");
    CREATE UNIQUE INDEX IF NOT EXISTS "ContentBrief_contentItemId_key" ON "ContentBrief"("contentItemId");
    CREATE INDEX IF NOT EXISTS "ContentDraft_contentItemId_idx" ON "ContentDraft"("contentItemId");
    CREATE INDEX IF NOT EXISTS "ContentDraft_status_idx" ON "ContentDraft"("status");
    CREATE INDEX IF NOT EXISTS "PublishingTarget_contentItemId_idx" ON "PublishingTarget"("contentItemId");
    CREATE INDEX IF NOT EXISTS "PublishingTarget_platform_idx" ON "PublishingTarget"("platform");
    CREATE INDEX IF NOT EXISTS "PublishingTarget_status_idx" ON "PublishingTarget"("status");
    CREATE INDEX IF NOT EXISTS "ContentMetric_contentItemId_idx" ON "ContentMetric"("contentItemId");
    CREATE INDEX IF NOT EXISTS "ContentMetric_platform_idx" ON "ContentMetric"("platform");
    CREATE INDEX IF NOT EXISTS "ContentMetric_capturedAt_idx" ON "ContentMetric"("capturedAt");
    CREATE INDEX IF NOT EXISTS "MonetizationLink_contentItemId_idx" ON "MonetizationLink"("contentItemId");
    CREATE INDEX IF NOT EXISTS "MonetizationLink_method_idx" ON "MonetizationLink"("method");
  `);
} finally {
  db.close();
}
