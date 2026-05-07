import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  idCounter: 0,
  rows: [] as Array<Record<string, unknown>>,
  workers: [] as Array<Record<string, unknown>>,
}));

function nowDate(): Date {
  return new Date("2026-05-07T12:00:00.000Z");
}

function cloneRow(row: Record<string, unknown>) {
  return { ...row };
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "lte" in value) {
      return new Date(row[key] as string | Date).getTime() <= new Date(value.lte as Date).getTime();
    }

    if (value && typeof value === "object" && "in" in value) {
      return (value.in as unknown[]).includes(row[key]);
    }

    return row[key] === value;
  });
}

function applyData(row: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    if (value && typeof value === "object" && "increment" in value) {
      row[key] = Number(row[key] ?? 0) + Number(value.increment);
      continue;
    }

    row[key] = value;
  }
  row.updatedAt = nowDate();
}

vi.mock("@/lib/db", () => ({
  db: {
    executionRequest: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.idCounter += 1;
        const row = {
          auditLog: "[]",
          claimedAt: null,
          completedAt: null,
          createdAt: nowDate(),
          error: "",
          id: `request-${state.idCounter}`,
          result: "",
          rollbackSnapshotId: null,
          rollbackPayload: "",
          maxRetries: 2,
          retryCount: 0,
          updatedAt: nowDate(),
          workerId: null,
          ...data,
        };
        state.rows.push(row);
        return cloneRow(row);
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.rows.find((candidate) => matchesWhere(candidate, where));
        return row ? cloneRow(row) : null;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        const rows = where
          ? state.rows.filter((candidate) => matchesWhere(candidate, where))
          : state.rows;
        return rows.map(cloneRow).reverse();
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.rows.find((candidate) => matchesWhere(candidate, where));
        return row ? cloneRow(row) : null;
      },
      count: async ({ where }: { where: Record<string, unknown> }) =>
        state.rows.filter((candidate) => matchesWhere(candidate, where)).length,
      update: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        const row = state.rows.find((candidate) => matchesWhere(candidate, where));
        if (!row) {
          throw new Error("Row not found.");
        }
        applyData(row, data);
        return cloneRow(row);
      },
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        const matched = state.rows.filter((candidate) => matchesWhere(candidate, where));
        for (const row of matched) {
          applyData(row, data);
        }
        return { count: matched.length };
      },
    },
    executionWorker: {
      findMany: async () => state.workers.map(cloneRow).reverse(),
      update: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        const row = state.workers.find((candidate) => matchesWhere(candidate, where));
        if (!row) {
          throw new Error("Worker not found.");
        }
        applyData(row, data);
        return cloneRow(row);
      },
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        const row = state.workers.find((candidate) => matchesWhere(candidate, where));
        if (row) {
          applyData(row, update);
          return cloneRow(row);
        }

        const worker = {
          createdAt: nowDate(),
          failedCount: 0,
          processedCount: 0,
          shutdownRequested: false,
          staleRecoveredCount: 0,
          startedAt: nowDate(),
          stoppedAt: null,
          updatedAt: nowDate(),
          ...create,
        };
        state.workers.push(worker);
        return cloneRow(worker);
      },
    },
  },
}));

import {
  createExecutionRequest,
  listRecentExecutionRequests,
} from "@/lib/autonomy/execution-request-store";
import {
  claimNextExecutionRequest,
  listWorkerRuntimeMonitor,
  markExecutionWorkerStopped,
  processNextExecutionRequest,
  recoverStaleExecutionRequests,
} from "@/lib/autonomy/execution-worker";

function tempWorkspace(): string {
  return mkdtempSync(path.join(os.tmpdir(), "creation-station-worker-"));
}

describe("worker execution architecture", () => {
  beforeEach(() => {
    state.idCounter = 0;
    state.rows = [];
    state.workers = [];
  });

  it("prevents duplicate execution requests with the same execution hash", async () => {
    const first = await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "one", path: "output/one.txt" },
      taskId: "task-a",
    });
    const duplicate = await createExecutionRequest({
      actionType: "file_write",
      payload: { path: "output/one.txt", content: "one" },
      taskId: "task-a",
    });

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.request.id).toBe(first.request.id);
    expect(state.rows).toHaveLength(1);
  });

  it("recovers pending work after a worker crash leaves a stale claim", async () => {
    await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "one", path: "output/one.txt" },
    });

    const claimed = await claimNextExecutionRequest({
      now: new Date("2026-05-07T12:00:00.000Z"),
      workerId: "worker-a",
    });
    const recovered = await recoverStaleExecutionRequests({
      now: new Date("2026-05-07T12:05:00.000Z"),
      staleMs: 60_000,
    });
    const queued = await listRecentExecutionRequests();

    expect(claimed?.status).toBe("running");
    expect(recovered).toBe(1);
    expect(queued[0]).toMatchObject({
      status: "pending",
      workerId: null,
    });
  });

  it("reports stale running jobs in worker monitoring", async () => {
    await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "one", path: "output/one.txt" },
    });

    await claimNextExecutionRequest({
      now: new Date("2026-05-07T12:00:00.000Z"),
      workerId: "worker-a",
    });
    const monitor = await listWorkerRuntimeMonitor({
      now: new Date("2026-05-07T12:05:00.000Z"),
      staleMs: 60_000,
    });

    expect(monitor.activeWorkers[0]).toMatchObject({
      currentRequestId: "request-1",
      id: "worker-a",
      status: "running",
    });
    expect(monitor.staleJobs).toBe(1);
  });

  it("prevents concurrency collisions when the action limit is reached", async () => {
    await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "one", path: "output/one.txt" },
      taskId: "task-a",
    });
    await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "two", path: "output/two.txt" },
      taskId: "task-b",
    });

    const first = await claimNextExecutionRequest({
      actionLimits: { file_write: 1 },
      workerId: "worker-a",
    });
    const second = await claimNextExecutionRequest({
      actionLimits: { file_write: 1 },
      workerId: "worker-b",
    });

    expect(first?.status).toBe("running");
    expect(second).toBeNull();
    expect(state.rows.filter((row) => row.status === "running")).toHaveLength(1);
  });

  it("rolls back the previous file version after a worker failure", async () => {
    const root = tempWorkspace();
    const outputDir = path.join(root, "output");
    const target = path.join(outputDir, "rollback.txt");

    try {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(target, "before", "utf8");
      await createExecutionRequest({
        actionType: "file_write",
        payload: {
          content: "after",
          path: "output/rollback.txt",
          simulateFailureAfterWrite: true,
        },
      });

      const result = await processNextExecutionRequest({
        workerId: "worker-a",
        workspaceRoot: root,
      });

      expect(result.processed).toBe(true);
      expect(result.processed ? result.status : "").toBe("failed_rolled_back");
      expect(readFileSync(target, "utf8")).toBe("before");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("persists queued and completed worker state", async () => {
    const root = tempWorkspace();

    try {
      const queued = await createExecutionRequest({
        actionType: "file_write",
        payload: { content: "done", path: "output/done.txt" },
      });
      const before = await listRecentExecutionRequests();
      const result = await processNextExecutionRequest({
        workerId: "worker-a",
        workspaceRoot: root,
      });
      const after = await listRecentExecutionRequests();

      expect(queued.request.status).toBe("pending");
      expect(before[0].status).toBe("pending");
      expect(result.processed).toBe(true);
      expect(after[0]).toMatchObject({
        result: "Wrote output/done.txt.",
        status: "completed",
        workerId: "worker-a",
      });
      expect(state.workers[0]).toMatchObject({
        processedCount: 1,
        status: "idle",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("persists graceful shutdown state after current work completes", async () => {
    await createExecutionRequest({
      actionType: "file_write",
      payload: { content: "done", path: "output/done.txt" },
    });

    await processNextExecutionRequest({
      workerId: "worker-a",
      workspaceRoot: tempWorkspace(),
    });
    const stopped = await markExecutionWorkerStopped({
      now: new Date("2026-05-07T12:01:00.000Z"),
      workerId: "worker-a",
    });

    expect(stopped).toMatchObject({
      healthState: "stopping",
      status: "stopped",
    });
  });
});
