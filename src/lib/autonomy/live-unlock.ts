import path from "node:path";

import {
  buildApprovalRequestIdempotencyKey,
  type ApprovalRequestRecord,
} from "@/lib/autonomy/execution-queue";
import type { ExecutionActionRequest } from "@/lib/autonomy/execution-sandbox";
import {
  WRITABLE_WORKSPACE_DIRECTORIES,
  type AdapterExecutionMode,
} from "@/lib/autonomy/tool-adapters";
import type { RollbackSnapshotDraft } from "@/lib/autonomy/rollback-manager";
import type { WorkspaceCapabilities } from "@/lib/autonomy/workspace-permissions";

export type LiveUnlockRequirementStatus = "invalid" | "missing" | "present" | "valid";

export type LiveUnlockRequirement = {
  label: string;
  status: LiveUnlockRequirementStatus;
  message: string;
};

export type LiveUnlockValidation = {
  actionId: string;
  mode: AdapterExecutionMode;
  requirements: LiveUnlockRequirement[];
  unlocked: boolean;
};

function payloadPath(action: ExecutionActionRequest): string {
  if (!action.payload || typeof action.payload !== "object" || Array.isArray(action.payload)) {
    return "";
  }

  const value = (action.payload as Record<string, unknown>).path;
  return typeof value === "string" ? value.trim() : "";
}

export function isAllowedWritableTarget(targetPath: string): boolean {
  if (!targetPath || targetPath.includes("../") || targetPath.includes("..\\")) {
    return false;
  }

  const normalizedPath = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(normalizedPath);

  if (normalized.startsWith("../") || normalized === "..") {
    return false;
  }

  return WRITABLE_WORKSPACE_DIRECTORIES.some(
    (directory) => normalized === directory || normalized.startsWith(`${directory}/`),
  );
}

function matchingSnapshot({
  action,
  snapshots,
}: {
  action: ExecutionActionRequest;
  snapshots: RollbackSnapshotDraft[];
}): RollbackSnapshotDraft | null {
  const targetPath = payloadPath(action);

  return (
    snapshots.find(
      (snapshot) =>
        snapshot.kind === "file" &&
        snapshot.targetPath?.replace(/\\/g, "/") === targetPath.replace(/\\/g, "/"),
    ) ?? null
  );
}

function matchingApproval({
  action,
  approvals,
}: {
  action: ExecutionActionRequest;
  approvals: ApprovalRequestRecord[];
}): ApprovalRequestRecord | null {
  const key = buildApprovalRequestIdempotencyKey(action);
  return approvals.find((approval) => approval.idempotencyKey === key) ?? null;
}

export function validateLiveExecutionUnlock({
  action,
  approvals,
  capabilities,
  mode = "live",
  snapshots,
}: {
  action: ExecutionActionRequest;
  approvals: ApprovalRequestRecord[];
  capabilities: WorkspaceCapabilities;
  mode?: AdapterExecutionMode;
  snapshots: RollbackSnapshotDraft[];
}): LiveUnlockValidation {
  const targetPath = payloadPath(action);
  const rollbackSnapshot = matchingSnapshot({ action, snapshots });
  const approval = matchingApproval({ action, approvals });
  const requirements: LiveUnlockRequirement[] = [
    {
      label: "Server permission",
      message: capabilities.canWriteFiles ? "canWriteFiles is true." : "canWriteFiles is false.",
      status: capabilities.canWriteFiles ? "valid" : "missing",
    },
    {
      label: "Rollback snapshot",
      message: rollbackSnapshot ? rollbackSnapshot.restoreReference : "No matching file snapshot exists.",
      status: rollbackSnapshot ? "present" : "missing",
    },
    {
      label: "Approval record",
      message: approval ? approval.idempotencyKey : "No queued approval record exists.",
      status: approval ? "present" : "missing",
    },
    {
      label: "Action type",
      message:
        action.type === "file_write"
          ? "file_write is eligible for live unlock."
          : `${action.type} remains locked.`,
      status: action.type === "file_write" ? "valid" : "invalid",
    },
    {
      label: "Writable directory",
      message: isAllowedWritableTarget(targetPath)
        ? `${targetPath} is inside an allowed writable directory.`
        : `${targetPath || "missing path"} is outside allowed writable directories.`,
      status: isAllowedWritableTarget(targetPath) ? "valid" : "invalid",
    },
  ];

  return {
    actionId: action.id,
    mode,
    requirements,
    unlocked: requirements.every(
      (requirement) => requirement.status === "valid" || requirement.status === "present",
    ),
  };
}
