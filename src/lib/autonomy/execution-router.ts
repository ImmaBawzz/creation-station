import { createAutonomyLogEvent, type AutonomyLogEvent } from "@/lib/autonomy/logger";
import type { RunLedgerEntry } from "@/lib/autonomy/run-ledger";

export type ExecutionRoute =
  | "simulation"
  | "approval_pending"
  | "approved"
  | "rejected"
  | "rollback_triggered";

export type ExecutionRouteResult = {
  route: ExecutionRoute;
  message: string;
  logs: AutonomyLogEvent[];
};

export function routeExecution(entry: RunLedgerEntry): ExecutionRouteResult {
  if (entry.executionState === "rollback_triggered") {
    return {
      route: "rollback_triggered",
      message: "Rollback simulation is queued. No production rollback will run.",
      logs: [
        createAutonomyLogEvent({
          event: "validation_blocked",
          message: "Rollback route selected in simulation only.",
          metadata: { route: "rollback_triggered" },
          taskId: entry.taskId,
        }),
      ],
    };
  }

  if (entry.approvalState === "rejected") {
    return {
      route: "rejected",
      message: "Execution route rejected by user decision.",
      logs: [
        createAutonomyLogEvent({
          event: "validation_blocked",
          message: "Rejected approval prevented execution routing.",
          metadata: { route: "rejected" },
          taskId: entry.taskId,
        }),
      ],
    };
  }

  if (entry.approvalState !== "approved") {
    return {
      route: "approval_pending",
      message: "Execution route is waiting for fresh explicit approval.",
      logs: [
        createAutonomyLogEvent({
          event: "validation_blocked",
          message: "Approval gate blocked execution routing.",
          metadata: { approvalState: entry.approvalState },
          taskId: entry.taskId,
        }),
      ],
    };
  }

  if (entry.executionState === "approved") {
    return {
      route: "approved",
      message: "Approved route remains simulation-only until real execution is enabled.",
      logs: [
        createAutonomyLogEvent({
          event: "task_started",
          message: "Approved simulation route selected.",
          metadata: { observerMode: true },
          taskId: entry.taskId,
        }),
      ],
    };
  }

  return {
    route: "simulation",
    message: "Default route remains read-only simulation.",
    logs: [
      createAutonomyLogEvent({
        event: "task_started",
        message: "Simulation route selected.",
        metadata: { observerMode: true },
        taskId: entry.taskId,
      }),
    ],
  };
}
