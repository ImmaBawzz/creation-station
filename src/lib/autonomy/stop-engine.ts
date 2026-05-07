export type StopReason =
  | "none"
  | "invalid_agent_state"
  | "max_iterations"
  | "stalled_task"
  | "retry_cap"
  | "timeout"
  | "recursion_prevention";

export type AutonomyPolicy = {
  maxIterations: number;
  maxRecursionDepth: number;
  maxRetriesPerTask: number;
  maxStalledMs: number;
  maxStateRecoveryAttempts: number;
  timeoutMs: number;
  maxTaskRevisits: number;
};

export type AutonomyRunState = {
  agentState?: string;
  elapsedMs: number;
  iterationCount: number;
  recursionDepth?: number;
  recoveryAttemptCount?: number;
  retryCountByTaskId: Map<string, number>;
  stalledTaskMsByTaskId?: Map<string, number>;
  visitedTaskIds: string[];
};

export type StopPolicyResult = {
  canContinue: boolean;
  stopReason: StopReason;
  messages: string[];
  policy: AutonomyPolicy;
};

export const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  maxIterations: 5,
  maxRecursionDepth: 2,
  maxRetriesPerTask: 2,
  maxStalledMs: 5_000,
  maxStateRecoveryAttempts: 1,
  timeoutMs: 10_000,
  maxTaskRevisits: 1,
};

const validAgentStates = new Set([
  undefined,
  "idle",
  "goal_selected",
  "plan_ready",
  "observing",
  "validating",
  "blocked",
  "stopped",
]);

export function enforceStopPolicy({
  policy,
  runState,
}: {
  policy?: Partial<AutonomyPolicy>;
  runState: AutonomyRunState;
}): StopPolicyResult {
  const resolvedPolicy = { ...DEFAULT_AUTONOMY_POLICY, ...policy };
  const messages: string[] = [];
  let stopReason: StopReason = "none";

  if (
    !validAgentStates.has(runState.agentState) ||
    (runState.recoveryAttemptCount ?? 0) > resolvedPolicy.maxStateRecoveryAttempts
  ) {
    stopReason = "invalid_agent_state";
    messages.push("Invalid agent state detected; observer-mode recovery must stop.");
  }

  if (runState.iterationCount > resolvedPolicy.maxIterations) {
    stopReason = stopReason === "none" ? "max_iterations" : stopReason;
    messages.push(
      `Iteration count ${runState.iterationCount} exceeds limit ${resolvedPolicy.maxIterations}.`,
    );
  }

  if ((runState.recursionDepth ?? 0) > resolvedPolicy.maxRecursionDepth) {
    stopReason = stopReason === "none" ? "recursion_prevention" : stopReason;
    messages.push(
      `Recursion depth ${runState.recursionDepth ?? 0} exceeds limit ${resolvedPolicy.maxRecursionDepth}.`,
    );
  }

  for (const [taskId, retryCount] of runState.retryCountByTaskId.entries()) {
    if (retryCount > resolvedPolicy.maxRetriesPerTask) {
      stopReason = stopReason === "none" ? "retry_cap" : stopReason;
      messages.push(
        `Task ${taskId} retry count ${retryCount} exceeds limit ${resolvedPolicy.maxRetriesPerTask}.`,
      );
    }
  }

  for (const [taskId, stalledMs] of runState.stalledTaskMsByTaskId?.entries() ?? []) {
    if (stalledMs > resolvedPolicy.maxStalledMs) {
      stopReason = stopReason === "none" ? "stalled_task" : stopReason;
      messages.push(
        `Task ${taskId} stalled for ${stalledMs}ms, exceeding limit ${resolvedPolicy.maxStalledMs}ms.`,
      );
    }
  }

  if (runState.elapsedMs > resolvedPolicy.timeoutMs) {
    stopReason = stopReason === "none" ? "timeout" : stopReason;
    messages.push(
      `Elapsed time ${runState.elapsedMs}ms exceeds timeout ${resolvedPolicy.timeoutMs}ms.`,
    );
  }

  const visitCounts = new Map<string, number>();
  for (const taskId of runState.visitedTaskIds) {
    const nextVisitCount = (visitCounts.get(taskId) ?? 0) + 1;
    visitCounts.set(taskId, nextVisitCount);

    if (nextVisitCount > resolvedPolicy.maxTaskRevisits) {
      stopReason = stopReason === "none" ? "recursion_prevention" : stopReason;
      messages.push(
        `Task ${taskId} was visited ${nextVisitCount} times; recursion prevention stopped the run.`,
      );
    }
  }

  return {
    canContinue: stopReason === "none",
    stopReason,
    messages,
    policy: resolvedPolicy,
  };
}
