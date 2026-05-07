-- Add persistent worker runtime state without changing existing request records.
ALTER TABLE "execution_requests" ADD COLUMN "rollback_payload" TEXT NOT NULL DEFAULT '';
ALTER TABLE "execution_requests" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "execution_requests" ADD COLUMN "max_retries" INTEGER NOT NULL DEFAULT 2;

CREATE TABLE "execution_workers" (
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

CREATE INDEX "execution_workers_action_type_idx" ON "execution_workers"("action_type");
CREATE INDEX "execution_workers_status_idx" ON "execution_workers"("status");
CREATE INDEX "execution_workers_health_state_idx" ON "execution_workers"("health_state");
CREATE INDEX "execution_workers_last_heartbeat_at_idx" ON "execution_workers"("last_heartbeat_at");
