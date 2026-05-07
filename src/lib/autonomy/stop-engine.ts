export type StopReason =
  | "none"
  | "max_iterations"
  | "retry_cap"
  | "timeout"
  | "recursion_prevention";

export type AutonomyPolicy = {
  maxIterations: number;
  maxRetriesPerTask: number;
  timeoutMs: number;
  maxTaskRevisits: number;
};

export type AutonomyRunState = {
  elapsedMs: number;
  iterationCount: number;
  retryCountByTaskId: Map<string, number>;
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
  maxRetriesPerTask: 2,
  timeoutMs: 10_000,
  maxTaskRevisits: 1,
};

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

  if (runState.iterationCount > resolvedPolicy.maxIterations) {
    stopReason = "max_iterations";
    messages.push(
      `Iteration count ${runState.iterationCount} exceeds limit ${resolvedPolicy.maxIterations}.`,
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
