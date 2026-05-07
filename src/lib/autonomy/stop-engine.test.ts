import { describe, expect, it } from "vitest";

import { enforceStopPolicy } from "@/lib/autonomy/stop-engine";

function baseRunState() {
  return {
    agentState: "validating",
    elapsedMs: 0,
    iterationCount: 1,
    retryCountByTaskId: new Map<string, number>(),
    visitedTaskIds: ["task-a"],
  };
}

describe("enforceStopPolicy hardening", () => {
  it("prevents infinite loops through repeated task visits", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        visitedTaskIds: ["task-a", "task-a"],
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("recursion_prevention");
  });

  it("stops when max retry threshold is exceeded", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        retryCountByTaskId: new Map([["task-a", 3]]),
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("retry_cap");
  });

  it("prevents runaway recursion by depth", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        recursionDepth: 3,
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("recursion_prevention");
  });

  it("detects stalled tasks", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        stalledTaskMsByTaskId: new Map([["task-a", 5_001]]),
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("stalled_task");
  });

  it("triggers timeout kills", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        elapsedMs: 10_001,
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("timeout");
  });

  it("stops invalid agent state recovery", () => {
    const result = enforceStopPolicy({
      runState: {
        ...baseRunState(),
        agentState: "executing-production",
        recoveryAttemptCount: 2,
      },
    });

    expect(result.canContinue).toBe(false);
    expect(result.stopReason).toBe("invalid_agent_state");
  });
});
