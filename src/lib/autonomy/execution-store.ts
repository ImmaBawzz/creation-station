import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import {
  buildExecutionLock,
  resolveLockAcquire,
  type ExecutionLockRecord,
} from "@/lib/autonomy/execution-locks";
import {
  createFileRollbackSnapshot,
  createTaskRollbackSnapshot,
  restoreTaskSnapshot,
  type RollbackSnapshotDraft,
} from "@/lib/autonomy/rollback-manager";
import {
  DEFAULT_FRESHNESS_FILES,
  buildWorkflowStateSnapshot,
  hashStableValue,
  snapshotFiles,
  validateStateFreshness,
  type WorkflowStateSnapshot,
} from "@/lib/autonomy/state-freshness";
import { orchestrateAutonomyGoal, type AutonomyPlan } from "@/lib/autonomy/orchestrator";

export type PersistedAutonomyRunResult = {
  duplicateBlocked: boolean;
  runId: string;
};

type PersistedLock = {
  acquiredAt: Date;
  expiresAt: Date;
  lockKey: string;
  owner: string;
  releasedAt: Date | null;
  runId: string | null;
  status: string;
};

function toLockRecord(lock: PersistedLock): ExecutionLockRecord {
  return {
    acquiredAt: lock.acquiredAt,
    expiresAt: lock.expiresAt,
    lockKey: lock.lockKey,
    owner: lock.owner,
    releasedAt: lock.releasedAt,
    runId: lock.runId,
    status: lock.status,
  };
}

function metadataJson(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function restorePriority(value: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (value === "LOW" || value === "HIGH" || value === "CRITICAL") {
    return value;
  }

  return "MEDIUM";
}

function planHash(plan: AutonomyPlan): string {
  return hashStableValue({
    goal: plan.goal,
    mode: plan.mode,
    tasks: plan.tasks.map((task) => ({
      action: task.action,
      dependsOn: task.dependsOn,
      expectedOutput: task.expectedOutput,
      id: task.id,
      order: task.order,
      title: task.title,
    })),
  });
}

async function currentWorkflowStateSnapshot(): Promise<WorkflowStateSnapshot> {
  const [plans, tasks] = await Promise.all([
    db.factoryPlan.findMany({
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.task.findMany({
      include: {
        blockers: {
          select: {
            blockerTaskId: true,
          },
        },
      },
    }),
  ]);

  return buildWorkflowStateSnapshot({
    files: snapshotFiles(),
    plans,
    tasks,
  });
}

function fileSnapshotDrafts(rootDir = process.cwd()): RollbackSnapshotDraft[] {
  return DEFAULT_FRESHNESS_FILES.map((filePath) => {
    const absolutePath = path.resolve(/*turbopackIgnore: true*/ rootDir, filePath);

    if (!existsSync(absolutePath)) {
      return null;
    }

    return createFileRollbackSnapshot({
      content: readFileSync(absolutePath, "utf8"),
      path: filePath,
    });
  }).filter((snapshot): snapshot is RollbackSnapshotDraft => Boolean(snapshot));
}

async function workflowRollbackSnapshots(): Promise<RollbackSnapshotDraft[]> {
  const tasks = await db.task.findMany();

  return [
    ...fileSnapshotDrafts(),
    ...tasks.map((task) => createTaskRollbackSnapshot(task)),
  ];
}

export async function persistAutonomyRun({
  goal,
  revision,
}: {
  goal: string;
  revision?: string;
}): Promise<PersistedAutonomyRunResult> {
  const plan = orchestrateAutonomyGoal({ goal, revision });
  const now = new Date();
  const runId = `run-${randomUUID()}`;
  const latestSnapshot = await currentWorkflowStateSnapshot();
  const currentPlanHash = planHash(plan);
  const lockKey = `execution:${currentPlanHash}:${latestSnapshot.hash}`;
  const existingLock = await db.executionLock.findUnique({ where: { lockKey } });
  const lockDecision = resolveLockAcquire({
    existingLock: existingLock ? toLockRecord(existingLock) : null,
    lockKey,
    now,
    owner: "creation-station-ui",
    runId,
  });

  if (!lockDecision.acquired) {
    if (lockDecision.lock.runId) {
      await db.executionEvent.create({
        data: {
          event: "validation_blocked",
          message: "Duplicate execution preview blocked by an active lock.",
          metadata: metadataJson({ lockKey, reason: lockDecision.reason }),
          runId: lockDecision.lock.runId,
        },
      });
    }

    return {
      duplicateBlocked: true,
      runId: lockDecision.lock.runId ?? "",
    };
  }

  const snapshots = await workflowRollbackSnapshots();

  await db.$transaction(async (tx) => {
    await tx.run.create({
      data: {
        id: runId,
        goal: plan.goal,
        mode: plan.mode,
        planHash: currentPlanHash,
        stateHash: latestSnapshot.hash,
        status: "approval_pending",
        stopReason: plan.stopPolicy.stopReason,
      },
    });

    await tx.executionLock.upsert({
      where: { lockKey },
      create: {
        ...buildExecutionLock({
          lockKey,
          now,
          owner: "creation-station-ui",
          runId,
          ttlMs: 15 * 60 * 1_000,
        }),
      },
      update: {
        acquiredAt: lockDecision.lock.acquiredAt,
        expiresAt: lockDecision.lock.expiresAt,
        owner: lockDecision.lock.owner,
        releasedAt: null,
        runId,
        status: "active",
      },
    });

    await tx.approval.createMany({
      data: plan.controlledExecution.executionHistory.map((entry) => ({
        approvedAt: entry.approvalState === "approved" ? now : null,
        decision: entry.approvalState === "approved" ? "approve" : "",
        expiresAt: new Date(entry.approvalExpiresAt),
        reason: "Observer-mode approval checkpoint. Execution remains disabled.",
        runId,
        status: entry.approvalState,
        taskId: entry.taskId,
        token: `${runId}:${entry.approvalToken}`,
      })),
    });

    await tx.executionEvent.createMany({
      data: plan.controlledExecution.executionLogs.map((log) => ({
        event: log.event,
        message: log.message,
        metadata: metadataJson(log.metadata),
        runId,
        taskId: log.taskId ?? null,
      })),
    });

    await tx.rollbackSnapshot.createMany({
      data: snapshots.map((snapshot) => ({
        content: snapshot.content,
        kind: snapshot.kind,
        metadata: metadataJson(snapshot.metadata),
        restoreReference: snapshot.restoreReference,
        runId,
        taskId: snapshot.kind === "task" ? snapshot.targetId : null,
        targetId: snapshot.targetId,
        targetPath: snapshot.targetPath,
      })),
    });
  });

  return {
    duplicateBlocked: false,
    runId,
  };
}

export async function updateApprovalDecision({
  approvalId,
  decision,
}: {
  approvalId: string;
  decision: "approve" | "reject";
}): Promise<string> {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: { run: true },
  });

  if (!approval) {
    throw new Error("Approval record not found.");
  }

  const latestSnapshot = await currentWorkflowStateSnapshot();
  const freshness = validateStateFreshness({
    expectedHash: approval.run.stateHash,
    latestSnapshot,
  });
  const now = new Date();

  if (freshness.status === "stale") {
    await db.$transaction([
      db.approval.update({
        where: { id: approvalId },
        data: {
          reason: freshness.staleReason,
          status: "stale",
        },
      }),
      db.run.update({
        where: { id: approval.runId },
        data: {
          staleReason: freshness.staleReason,
          status: "stale_blocked",
        },
      }),
      db.executionEvent.create({
        data: {
          event: "validation_blocked",
          message: "Stale state blocked approval from advancing.",
          metadata: metadataJson({
            expectedHash: freshness.expectedHash,
            latestHash: freshness.latestHash,
          }),
          runId: approval.runId,
          taskId: approval.taskId,
        },
      }),
    ]);

    return approval.runId;
  }

  await db.$transaction([
    db.approval.update({
      where: { id: approvalId },
      data: {
        approvedAt: decision === "approve" ? now : null,
        decision,
        reason:
          decision === "approve"
            ? "Human approved observer-mode tracking. No execution was performed."
            : "Human rejected the observer-mode approval checkpoint.",
        status: decision === "approve" ? "approved" : "rejected",
      },
    }),
    db.run.update({
      where: { id: approval.runId },
      data: {
        status: decision === "approve" ? "approved_observer_only" : "rejected",
      },
    }),
    db.executionEvent.create({
      data: {
        event: "validation_blocked",
        message:
          decision === "approve"
            ? "Approval persisted, but execution remains disabled."
            : "Approval rejection persisted.",
        metadata: metadataJson({ decision }),
        runId: approval.runId,
        taskId: approval.taskId,
      },
    }),
  ]);

  return approval.runId;
}

export async function releaseRunLocks(runId: string): Promise<void> {
  await db.executionLock.updateMany({
    where: {
      runId,
      status: "active",
    },
    data: {
      releasedAt: new Date(),
      status: "released",
    },
  });
}

export async function markExpiredLocks(now = new Date()): Promise<number> {
  const result = await db.executionLock.updateMany({
    where: {
      expiresAt: { lte: now },
      status: "active",
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
}

export async function restoreTaskRollbackSnapshotById(snapshotId: string): Promise<string> {
  const snapshot = await db.rollbackSnapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    throw new Error("Rollback snapshot not found.");
  }

  if (snapshot.kind !== "task") {
    throw new Error("File rollback snapshots are restoration references only in v1.9.");
  }

  const restoredTask = restoreTaskSnapshot({
    content: snapshot.content,
    kind: "task",
    metadata: JSON.parse(snapshot.metadata) as Record<string, string | number | boolean | null>,
    restoreReference: snapshot.restoreReference,
    targetId: snapshot.targetId,
    targetPath: snapshot.targetPath,
  });

  await db.$transaction([
    db.task.update({
      where: { id: restoredTask.id },
      data: {
        description: restoredTask.description,
        labels: restoredTask.labels ?? "",
        priority: restorePriority(restoredTask.priority),
        status: restoredTask.status,
        title: restoredTask.title,
      },
    }),
    db.rollbackSnapshot.update({
      where: { id: snapshotId },
      data: { restoredAt: new Date() },
    }),
    db.executionEvent.create({
      data: {
        event: "validation_blocked",
        message: "Rollback task snapshot restored by explicit user action.",
        metadata: metadataJson({ restoreReference: snapshot.restoreReference }),
        runId: snapshot.runId,
        taskId: snapshot.taskId,
      },
    }),
  ]);

  return snapshot.runId;
}
