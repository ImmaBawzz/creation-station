import { db } from "@/lib/db";
import {
  parseExecutionPayload,
  type ExecutionRequestRecord,
} from "@/lib/autonomy/execution-request-store";
import {
  restoreFileRollbackSnapshot,
  runFileAdapter,
} from "@/lib/autonomy/tool-adapters";
import { runMusicVideoBuilderV1, type MusicVideoBuilderStage } from "@/lib/creative-execution";
import type { RollbackSnapshotDraft } from "@/lib/autonomy/rollback-manager";

export type WorkerProcessResult =
  | {
      processed: false;
      reason: "no_pending_jobs" | "claim_lost";
    }
  | {
      processed: true;
      request: ExecutionRequestRecord;
      status: string;
    };

export type ExecutionWorkerOptions = {
  actionLimits?: Record<string, number>;
  now?: Date;
  workspaceRoot?: string;
  workerId: string;
};

export type ExecutionWorkerRecord = {
  actionType: string;
  currentRequestId: string | null;
  failedCount: number;
  healthState: string;
  id: string;
  lastHeartbeatAt: Date;
  processedCount: number;
  shutdownRequested: boolean;
  staleRecoveredCount: number;
  startedAt: Date;
  status: string;
  stoppedAt: Date | null;
};

export type WorkerRuntimeMonitor = {
  activeWorkers: ExecutionWorkerRecord[];
  failedJobs: number;
  jobThroughput: number;
  staleJobs: number;
};

function payloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function payloadRecord(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function outputPathAllowed(targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized === "output" || normalized.startsWith("output/");
}

function fileSnapshotForRequest({
  content,
  targetPath,
}: {
  content: string;
  targetPath: string;
}): RollbackSnapshotDraft {
  return {
    content,
    kind: "file",
    metadata: {
      worker: true,
    },
    restoreReference: `file:${targetPath}`,
    targetId: null,
    targetPath,
  };
}

function parseRollbackPayload(payload: string): RollbackSnapshotDraft | null {
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as RollbackSnapshotDraft;
    return parsed && parsed.kind === "file" ? parsed : null;
  } catch {
    return null;
  }
}

function actionLimitFor(
  actionType: string,
  actionLimits: Record<string, number> = {},
): number {
  const configured = actionLimits[actionType];
  return Number.isInteger(configured) && configured > 0 ? configured : 1;
}

export async function recordWorkerHeartbeat({
  actionType = "file_write",
  currentRequestId = null,
  healthState = "healthy",
  now = new Date(),
  status,
  workerId,
}: {
  actionType?: string;
  currentRequestId?: string | null;
  healthState?: "healthy" | "stale" | "stopping" | "unhealthy";
  now?: Date;
  status: "idle" | "running" | "stopped" | "stopping";
  workerId: string;
}): Promise<ExecutionWorkerRecord> {
  return db.executionWorker.upsert({
    where: { id: workerId },
    create: {
      actionType,
      currentRequestId,
      healthState,
      id: workerId,
      lastHeartbeatAt: now,
      status,
    },
    update: {
      actionType,
      currentRequestId,
      healthState,
      lastHeartbeatAt: now,
      status,
      stoppedAt: status === "stopped" ? now : null,
    },
  });
}

async function recordWorkerOutcome({
  recoveredStale = 0,
  requestStatus,
  workerId,
}: {
  recoveredStale?: number;
  requestStatus: string;
  workerId: string;
}): Promise<void> {
  await db.executionWorker.update({
    where: { id: workerId },
    data: {
      currentRequestId: null,
      failedCount: ["failed", "failed_rolled_back"].includes(requestStatus)
        ? { increment: 1 }
        : undefined,
      processedCount: { increment: 1 },
      staleRecoveredCount: recoveredStale > 0 ? { increment: recoveredStale } : undefined,
      status: "idle",
    },
  });
}

async function failRequest({
  auditLog = "[]",
  error,
  id,
  rollbackSnapshotId = null,
  status = "failed",
}: {
  auditLog?: string;
  error: string;
  id: string;
  rollbackSnapshotId?: string | null;
  status?: "failed" | "failed_rolled_back";
}): Promise<ExecutionRequestRecord> {
  return db.executionRequest.update({
    where: { id },
    data: {
      auditLog,
      completedAt: new Date(),
      error,
      rollbackSnapshotId,
      status,
    },
  });
}

async function processMusicVideoBuilderRequest({
  request,
}: {
  request: ExecutionRequestRecord;
}): Promise<ExecutionRequestRecord> {
  const payload = parseExecutionPayload(request.payload);
  const audioPath = payloadString(payload, "audioPath");
  const sourceImagePath = payloadString(payload, "sourceImagePath");
  const title = payloadString(payload, "title") || "Untitled Music Video";
  const visualPrompt = payloadString(payload, "visualPrompt");
  const workflow = payloadRecord(payload, "workflow");

  if (!audioPath) {
    return failRequest({
      error: "Audio upload is required.",
      id: request.id,
    });
  }

  if (!visualPrompt) {
    return failRequest({
      error: "Visual prompt is required.",
      id: request.id,
    });
  }

  if (Object.keys(workflow).length === 0) {
    return failRequest({
      error: "Workflow preset is required.",
      id: request.id,
    });
  }

  try {
    const output = await runMusicVideoBuilderV1({
      input: {
        audioPath,
        durationSeconds: payloadNumber(payload, "durationSeconds"),
        sourceImagePath: sourceImagePath || undefined,
        title,
        visualPrompt,
        workflow,
      },
      onStage: async (stage: MusicVideoBuilderStage) => {
        await db.executionRequest.update({
          where: { id: request.id },
          data: { status: stage },
        });
      },
    });

    return db.executionRequest.update({
      where: { id: request.id },
      data: {
        auditLog: JSON.stringify([
          {
            event: "music_video_builder_v1_completed",
            message: "MusicVideoBuilderV1 completed and packaged the release assets.",
          },
        ]),
        completedAt: new Date(),
        error: "",
        result: JSON.stringify(output),
        status: "completed",
      },
    });
  } catch (error) {
    return failRequest({
      error: error instanceof Error ? error.message : "MusicVideoBuilderV1 failed.",
      id: request.id,
    });
  }
}

export async function claimNextExecutionRequest({
  actionLimits,
  now = new Date(),
  workerId,
}: {
  actionLimits?: Record<string, number>;
  now?: Date;
  workerId: string;
}): Promise<ExecutionRequestRecord | null> {
  const candidates = await db.executionRequest.findMany({
    orderBy: { createdAt: "asc" },
    take: 20,
    where: {
      approvalStatus: "approved",
      status: "pending",
      workerId: null,
    },
  });

  for (const candidate of candidates) {
    const activeForAction = await db.executionRequest.count({
      where: {
        actionType: candidate.actionType,
        status: "running",
      },
    });

    if (activeForAction >= actionLimitFor(candidate.actionType, actionLimits)) {
      continue;
    }

    const claim = await db.executionRequest.updateMany({
      where: {
        id: candidate.id,
        status: "pending",
        workerId: null,
      },
      data: {
        claimedAt: now,
        status: "running",
        workerId,
      },
    });

    if (claim.count !== 1) {
      continue;
    }

    await recordWorkerHeartbeat({
      currentRequestId: candidate.id,
      now,
      status: "running",
      workerId,
    });

    return db.executionRequest.findUnique({ where: { id: candidate.id } });
  }

  await recordWorkerHeartbeat({
    currentRequestId: null,
    now,
    status: "idle",
    workerId,
  });

  return null;
}

export async function recoverStaleExecutionRequests({
  now = new Date(),
  staleMs,
  workerId = "stale-recovery",
  workspaceRoot,
}: {
  now?: Date;
  staleMs: number;
  workerId?: string;
  workspaceRoot?: string;
}): Promise<number> {
  const staleBefore = new Date(now.getTime() - staleMs);
  const staleRequests = await db.executionRequest.findMany({
    where: {
      claimedAt: { lte: staleBefore },
      status: "running",
    },
  });

  for (const request of staleRequests) {
    const rollbackSnapshot = parseRollbackPayload(request.rollbackPayload);
    const retryAvailable = request.retryCount < request.maxRetries;
    let auditLog = request.auditLog;

    if (rollbackSnapshot) {
      const rollbackResult = await restoreFileRollbackSnapshot({
        context: {
          actor: workerId,
          auditLog: JSON.parse(request.auditLog) as [],
          capabilities: {
            canDeploy: false,
            canRunCommands: false,
            canUseExternalApis: false,
            canUseGit: false,
            canWriteFiles: true,
          },
          mode: "live",
          workspaceRoot,
        },
        snapshot: rollbackSnapshot,
      });
      auditLog = JSON.stringify(rollbackResult.auditLog);
    }

    await db.executionRequest.update({
      where: { id: request.id },
      data: {
        auditLog,
        error: retryAvailable
          ? "Recovered from stale worker claim; job returned to pending."
          : "Recovered from stale worker claim; retry limit reached.",
        retryCount: { increment: 1 },
        status: retryAvailable ? "pending" : rollbackSnapshot ? "failed_rolled_back" : "failed",
        workerId: null,
      },
    });
  }

  return staleRequests.length;
}

export async function processClaimedExecutionRequest({
  request,
  workspaceRoot,
  workerId,
}: {
  request: ExecutionRequestRecord;
  workspaceRoot?: string;
  workerId: string;
}): Promise<ExecutionRequestRecord> {
  if (request.workerId !== workerId || request.status !== "running") {
    return failRequest({
      error: "Worker cannot process a request it does not own.",
      id: request.id,
    });
  }

  if (request.actionType === "music_video_builder_v1") {
    return processMusicVideoBuilderRequest({ request });
  }

  if (request.actionType !== "file_write") {
    return failRequest({
      error: "Only file_write and music_video_builder_v1 execution requests are supported by the worker.",
      id: request.id,
    });
  }

  const payload = parseExecutionPayload(request.payload);
  const targetPath = payloadString(payload, "path");
  const content = payloadString(payload, "content");
  const simulateFailureAfterWrite = payload.simulateFailureAfterWrite === true;

  if (!targetPath || !content) {
    return failRequest({
      error: "file_write requires path and content.",
      id: request.id,
    });
  }

  if (!outputPathAllowed(targetPath)) {
    return failRequest({
      error: "Worker file_write is restricted to output/.",
      id: request.id,
    });
  }

  const writeResult = await runFileAdapter({
    content,
    context: {
      actor: workerId,
      capabilities: {
        canDeploy: false,
        canRunCommands: false,
        canUseExternalApis: false,
        canUseGit: false,
        canWriteFiles: true,
      },
      mode: "live",
      workspaceRoot,
    },
    operation: "write",
    targetPath,
  });
  const rollbackSnapshotId = writeResult.rollbackId;
  const rollbackPayload = writeResult.snapshot ? JSON.stringify(writeResult.snapshot) : "";

  if (!writeResult.ok || !writeResult.snapshot) {
    return failRequest({
      auditLog: JSON.stringify(writeResult.auditLog),
      error: writeResult.error ?? "File adapter failed.",
      id: request.id,
      rollbackSnapshotId,
    });
  }

  await db.executionRequest.update({
    where: { id: request.id },
    data: {
      rollbackPayload,
      rollbackSnapshotId,
    },
  });

  if (simulateFailureAfterWrite) {
    const rollbackResult = await restoreFileRollbackSnapshot({
      context: {
        actor: workerId,
        auditLog: writeResult.auditLog,
        capabilities: {
          canDeploy: false,
          canRunCommands: false,
          canUseExternalApis: false,
          canUseGit: false,
          canWriteFiles: true,
        },
        mode: "live",
        workspaceRoot,
      },
      snapshot: fileSnapshotForRequest({
        content: writeResult.snapshot.content,
        targetPath,
      }),
    });

    return failRequest({
      auditLog: JSON.stringify(rollbackResult.auditLog),
      error: "Worker failure after write; rollback was attempted.",
      id: request.id,
      rollbackSnapshotId,
      status: "failed_rolled_back",
    });
  }

  return db.executionRequest.update({
    where: { id: request.id },
    data: {
      auditLog: JSON.stringify(writeResult.auditLog),
      completedAt: new Date(),
      error: "",
      result: writeResult.output,
      rollbackSnapshotId,
      rollbackPayload,
      status: "completed",
    },
  });
}

export async function processNextExecutionRequest(
  options: ExecutionWorkerOptions,
): Promise<WorkerProcessResult> {
  const recoveredStale = await recoverStaleExecutionRequests({
    now: options.now,
    staleMs: 60_000,
    workerId: options.workerId,
    workspaceRoot: options.workspaceRoot,
  });
  const request = await claimNextExecutionRequest(options);

  if (!request) {
    return {
      processed: false,
      reason: "no_pending_jobs",
    };
  }

  if (request.workerId !== options.workerId) {
    return {
      processed: false,
      reason: "claim_lost",
    };
  }

  const processedRequest = await processClaimedExecutionRequest({
    request,
    workerId: options.workerId,
    workspaceRoot: options.workspaceRoot,
  });
  await recordWorkerOutcome({
    recoveredStale,
    requestStatus: processedRequest.status,
    workerId: options.workerId,
  });

  return {
    processed: true,
    request: processedRequest,
    status: processedRequest.status,
  };
}

export async function markExecutionWorkerStopped({
  now = new Date(),
  workerId,
}: {
  now?: Date;
  workerId: string;
}): Promise<ExecutionWorkerRecord> {
  return recordWorkerHeartbeat({
    healthState: "stopping",
    now,
    status: "stopped",
    workerId,
  });
}

export async function listWorkerRuntimeMonitor({
  now = new Date(),
  staleMs = 60_000,
}: {
  now?: Date;
  staleMs?: number;
} = {}): Promise<WorkerRuntimeMonitor> {
  const staleBefore = new Date(now.getTime() - staleMs);
  const [workers, completedJobs, failedJobs, staleJobs] = await Promise.all([
    db.executionWorker.findMany({
      orderBy: { lastHeartbeatAt: "desc" },
      take: 8,
    }),
    db.executionRequest.count({
      where: { status: "completed" },
    }),
    db.executionRequest.count({
      where: { status: { in: ["failed", "failed_rolled_back"] } },
    }),
    db.executionRequest.count({
      where: {
        claimedAt: { lte: staleBefore },
        status: "running",
      },
    }),
  ]);

  return {
    activeWorkers: workers,
    failedJobs,
    jobThroughput: completedJobs,
    staleJobs,
  };
}
