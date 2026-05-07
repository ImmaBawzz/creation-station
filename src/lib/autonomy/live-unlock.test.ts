import { describe, expect, it } from "vitest";

import { buildExecutionQueue } from "@/lib/autonomy/execution-queue";
import type { ExecutionActionRequest } from "@/lib/autonomy/execution-sandbox";
import { validateLiveExecutionUnlock } from "@/lib/autonomy/live-unlock";
import { createFileRollbackSnapshot } from "@/lib/autonomy/rollback-manager";
import type { WorkspaceCapabilities } from "@/lib/autonomy/workspace-permissions";

function capabilities(overrides: Partial<WorkspaceCapabilities> = {}): WorkspaceCapabilities {
  return {
    canDeploy: false,
    canRunCommands: false,
    canUseExternalApis: false,
    canUseGit: false,
    canWriteFiles: false,
    ...overrides,
  };
}

function fileWrite(path = "output/live.txt"): ExecutionActionRequest {
  return {
    id: "write-live",
    payload: {
      content: "live payload",
      path,
    },
    type: "file_write",
  };
}

describe("server-side live execution unlock", () => {
  it("denies live unlock when canWriteFiles is missing", () => {
    const action = fileWrite();
    const queue = buildExecutionQueue([action]);
    const validation = validateLiveExecutionUnlock({
      action,
      approvals: queue.approvalRequests,
      capabilities: capabilities(),
      snapshots: [
        createFileRollbackSnapshot({
          content: "before",
          path: "output/live.txt",
        }),
      ],
    });

    expect(validation.unlocked).toBe(false);
    expect(validation.requirements).toContainEqual(
      expect.objectContaining({
        label: "Server permission",
        status: "missing",
      }),
    );
  });

  it("denies live unlock when the rollback snapshot is missing", () => {
    const action = fileWrite();
    const queue = buildExecutionQueue([action]);
    const validation = validateLiveExecutionUnlock({
      action,
      approvals: queue.approvalRequests,
      capabilities: capabilities({ canWriteFiles: true }),
      snapshots: [],
    });

    expect(validation.unlocked).toBe(false);
    expect(validation.requirements).toContainEqual(
      expect.objectContaining({
        label: "Rollback snapshot",
        status: "missing",
      }),
    );
  });

  it("allows live unlock only for safe file_write into an allowed directory", () => {
    const action = fileWrite();
    const queue = buildExecutionQueue([action]);
    const validation = validateLiveExecutionUnlock({
      action,
      approvals: queue.approvalRequests,
      capabilities: capabilities({ canWriteFiles: true }),
      snapshots: [
        createFileRollbackSnapshot({
          content: "before",
          path: "output/live.txt",
        }),
      ],
    });

    expect(validation.unlocked).toBe(true);
    expect(validation.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Approval record", status: "present" }),
        expect.objectContaining({ label: "Writable directory", status: "valid" }),
      ]),
    );
  });

  it("keeps non-file actions locked even with permission, snapshot, and approval records", () => {
    const action: ExecutionActionRequest = {
      id: "git-a",
      payload: { message: "Commit safe change" },
      type: "git_commit",
    };
    const queue = buildExecutionQueue([action]);
    const validation = validateLiveExecutionUnlock({
      action,
      approvals: queue.approvalRequests,
      capabilities: capabilities({ canUseGit: true, canWriteFiles: true }),
      snapshots: [
        createFileRollbackSnapshot({
          content: "before",
          path: "output/live.txt",
        }),
      ],
    });

    expect(validation.unlocked).toBe(false);
    expect(validation.requirements).toContainEqual(
      expect.objectContaining({
        label: "Action type",
        status: "invalid",
      }),
    );
  });
});

