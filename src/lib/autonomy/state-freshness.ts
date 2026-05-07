import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type FreshnessStatus = "fresh" | "stale";

export type FileStateSnapshot = {
  exists: boolean;
  hash: string;
  mtimeMs: number | null;
  path: string;
  size: number | null;
};

export type TaskStateSnapshot = {
  blockers: string[];
  id: string;
  planId: string;
  status: string;
  updatedAt: string;
};

export type WorkflowStateSnapshot = {
  files: FileStateSnapshot[];
  hash: string;
  plans: Array<{
    id: string;
    status: string;
    updatedAt: string;
  }>;
  tasks: TaskStateSnapshot[];
};

export type FreshnessValidation = {
  status: FreshnessStatus;
  expectedHash: string;
  latestHash: string;
  staleReason: string;
};

type SnapshotTask = {
  blockers?: Array<{ blockerTaskId: string }>;
  id: string;
  planId: string;
  status: string;
  updatedAt: Date | string;
};

type SnapshotPlan = {
  id: string;
  status: string;
  updatedAt: Date | string;
};

export const DEFAULT_FRESHNESS_FILES = [
  "package.json",
  "prisma/schema.prisma",
  "src/app/actions.ts",
  "src/lib/autonomy/orchestrator.ts",
];

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, nestedValue) => {
    if (!nestedValue || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });
}

export function hashStableValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function snapshotFiles({
  files = DEFAULT_FRESHNESS_FILES,
  rootDir = process.cwd(),
}: {
  files?: string[];
  rootDir?: string;
} = {}): FileStateSnapshot[] {
  return files.map((filePath) => {
    const absolutePath = path.resolve(/*turbopackIgnore: true*/ rootDir, filePath);

    if (!existsSync(absolutePath)) {
      return {
        exists: false,
        hash: "missing",
        mtimeMs: null,
        path: filePath,
        size: null,
      };
    }

    const stat = statSync(absolutePath);

    return {
      exists: true,
      hash: createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
      mtimeMs: stat.mtimeMs,
      path: filePath,
      size: stat.size,
    };
  });
}

export function buildWorkflowStateSnapshot({
  files,
  plans,
  tasks,
}: {
  files?: FileStateSnapshot[];
  plans: SnapshotPlan[];
  tasks: SnapshotTask[];
}): WorkflowStateSnapshot {
  const normalizedPlans = plans
    .map((plan) => ({
      id: plan.id,
      status: plan.status,
      updatedAt: new Date(plan.updatedAt).toISOString(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const normalizedTasks = tasks
    .map((task) => ({
      blockers: (task.blockers ?? [])
        .map((blocker) => blocker.blockerTaskId)
        .sort((left, right) => left.localeCompare(right)),
      id: task.id,
      planId: task.planId,
      status: task.status,
      updatedAt: new Date(task.updatedAt).toISOString(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const normalizedFiles = [...(files ?? [])].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const snapshot = {
    files: normalizedFiles,
    plans: normalizedPlans,
    tasks: normalizedTasks,
  };

  return {
    ...snapshot,
    hash: hashStableValue(snapshot),
  };
}

export function validateStateFreshness({
  expectedHash,
  latestSnapshot,
}: {
  expectedHash: string;
  latestSnapshot: WorkflowStateSnapshot;
}): FreshnessValidation {
  if (expectedHash === latestSnapshot.hash) {
    return {
      status: "fresh",
      expectedHash,
      latestHash: latestSnapshot.hash,
      staleReason: "",
    };
  }

  return {
    status: "stale",
    expectedHash,
    latestHash: latestSnapshot.hash,
    staleReason: "Current file, plan, task, or blocker state differs from the state captured for this run.",
  };
}
