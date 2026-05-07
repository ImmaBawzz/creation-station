export type AuditResult = "blocked" | "failed" | "restored" | "simulated" | "succeeded";

export type ExecutionAuditLogEntry = Readonly<{
  action: string;
  actor: string;
  result: AuditResult;
  rollbackId: string | null;
  timestamp: string;
}>;

export function createExecutionAuditLogEntry({
  action,
  actor,
  result,
  rollbackId = null,
  timestamp = new Date().toISOString(),
}: {
  action: string;
  actor: string;
  result: AuditResult;
  rollbackId?: string | null;
  timestamp?: string;
}): ExecutionAuditLogEntry {
  return Object.freeze({
    action,
    actor,
    result,
    rollbackId,
    timestamp,
  });
}

export function appendExecutionAuditLog(
  entries: readonly ExecutionAuditLogEntry[],
  entry: ExecutionAuditLogEntry,
): readonly ExecutionAuditLogEntry[] {
  return Object.freeze([...entries, entry]);
}
