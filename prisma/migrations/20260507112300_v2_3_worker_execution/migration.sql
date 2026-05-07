-- v2.3 worker execution queue.
-- Stores backend execution requests for worker polling. Frontend/UI code
-- enqueues requests only; adapters run in the worker layer.

CREATE TABLE "execution_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approval_status" TEXT NOT NULL DEFAULT 'approved',
    "rollback_snapshot_id" TEXT,
    "execution_hash" TEXT NOT NULL,
    "worker_id" TEXT,
    "result" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "audit_log" TEXT NOT NULL DEFAULT '[]',
    "claimed_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "execution_requests_execution_hash_key" ON "execution_requests"("execution_hash");
CREATE INDEX "execution_requests_status_idx" ON "execution_requests"("status");
CREATE INDEX "execution_requests_approval_status_idx" ON "execution_requests"("approval_status");
CREATE INDEX "execution_requests_worker_id_idx" ON "execution_requests"("worker_id");
CREATE INDEX "execution_requests_created_at_idx" ON "execution_requests"("created_at");
