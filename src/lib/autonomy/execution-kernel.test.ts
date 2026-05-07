import { describe, expect, it } from "vitest";

import { buildExecutionKernelPreview } from "@/lib/autonomy/execution-kernel";
import type { ExecutionActionRequest } from "@/lib/autonomy/execution-sandbox";

describe("execution kernel v2", () => {
  it("allows only one high-risk execution slot at a time", () => {
    const requests: ExecutionActionRequest[] = [
      {
        id: "shell-a",
        payload: { command: "npm run lint" },
        type: "terminal_command",
      },
      {
        id: "shell-b",
        payload: { command: "npx tsc --noEmit" },
        type: "terminal_command",
      },
    ];

    const preview = buildExecutionKernelPreview({ requests });

    expect(preview.queue.activeHighRiskActionId).toBe("shell-a");
    expect(preview.queue.items[0]).toMatchObject({
      approvalRequirement: "manual_override",
      status: "manual_override_required",
    });
    expect(preview.queue.items[1]).toMatchObject({
      status: "blocked",
    });
  });

  it("records rollback recovery and retry state after a simulated failure", () => {
    const requests: ExecutionActionRequest[] = [
      {
        id: "write-a",
        payload: { content: "next", path: "output/agent-next-input.md" },
        type: "file_write",
      },
    ];

    const preview = buildExecutionKernelPreview({
      options: {
        failedActionIds: ["write-a"],
        retryCountsByActionId: { "write-a": 0 },
      },
      requests,
    });

    expect(preview.queue.items[0].status).toBe("retry_scheduled");
    expect(preview.queue.failureLogs[0]).toMatchObject({
      actionId: "write-a",
      retryLimit: 1,
    });
    expect(preview.queue.rollbackControls[0]).toMatchObject({
      actionId: "write-a",
      enabled: true,
    });
  });

  it("deduplicates identical approval requests by idempotency key", () => {
    const requests: ExecutionActionRequest[] = [
      {
        id: "write-a",
        payload: { content: "next", path: "output/agent-next-input.md" },
        type: "file_write",
      },
      {
        id: "write-b",
        payload: { content: "next", path: "output/agent-next-input.md" },
        type: "file_write",
      },
    ];

    const preview = buildExecutionKernelPreview({ requests });

    expect(preview.queue.approvalRequests).toHaveLength(1);
    expect(preview.queue.approvalRequests[0]).toMatchObject({
      actionId: "write-a",
      reusedByActionIds: ["write-b"],
      status: "pending",
    });
    expect(preview.queue.items.map((item) => item.approvalRequestKey)).toEqual([
      preview.queue.approvalRequests[0].idempotencyKey,
      preview.queue.approvalRequests[0].idempotencyKey,
    ]);
  });

  it("rejects stale planned state before execution simulation advances", () => {
    const requests: ExecutionActionRequest[] = [
      {
        expectedStateHash: "old-state",
        id: "read-a",
        payload: { path: "package.json" },
        type: "file_read",
      },
    ];

    const preview = buildExecutionKernelPreview({
      currentStateHash: "new-state",
      requests,
    });

    expect(preview.queue.items[0]).toMatchObject({
      status: "stale_rejected",
    });
    expect(preview.queue.items[0].reason).toContain("Stale state rejection");
  });

  it("blocks malformed actions and dangerous terminal payloads in the sandbox", () => {
    const requests: ExecutionActionRequest[] = [
      {
        id: "",
        payload: "not-an-object",
        type: "file_read",
      },
      {
        id: "shell-danger",
        payload: { command: "git reset --hard HEAD" },
        type: "terminal_command",
      },
    ];

    const preview = buildExecutionKernelPreview({ requests });

    expect(preview.queue.items[0]).toMatchObject({
      status: "blocked",
    });
    expect(preview.queue.items[0].sandbox.malformed).toBe(true);
    expect(preview.queue.items[1]).toMatchObject({
      status: "blocked",
    });
    expect(preview.sandboxViolations[1].reasons).toContain(
      "Dangerous terminal payload is blocked.",
    );
  });
});

