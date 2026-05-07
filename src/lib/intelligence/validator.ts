import { taskBlockerIds } from "@/lib/task-labels";

export type TaskWaitingState = {
  blockerIds: string[];
  blockerNames: string[];
  isWaiting: boolean;
  label: string;
  missingBlockerIds: string[];
  unresolvedBlockerNames: string[];
};

export type TaskStaleness = {
  action: string;
  daysStale: number;
  label: string;
  severity: "high" | "medium";
};

export const closedTaskStatuses = new Set(["ARCHIVED", "DONE"]);
export const nextWorkTaskStatuses = new Set(["DOING", "TODO"]);

export function daysSince(value: Date | string, now: Date): number {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay),
  );
}

export function taskBlockerReferenceIds(task: {
  blockers?: Array<{ blockerTaskId: string }>;
  labels?: string | null;
}): string[] {
  const persistedBlockerIds =
    task.blockers?.map((blocker) => blocker.blockerTaskId).filter(Boolean) ?? [];

  return persistedBlockerIds.length > 0 ? persistedBlockerIds : taskBlockerIds(task);
}

export function getTaskWaitingState(
  task: {
    blockers?: Array<{ blockerTaskId: string }>;
    id: string;
    labels?: string | null;
    status: string;
    title: string;
  },
  tasks: Array<{ id: string; status: string; title: string }>,
): TaskWaitingState {
  const blockerIds = taskBlockerReferenceIds(task);
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const blockers = blockerIds
    .map((blockerId) => taskById.get(blockerId))
    .filter((blocker): blocker is { id: string; status: string; title: string } =>
      Boolean(blocker),
    );
  const blockerNames = blockers.map((blocker) => blocker.title);
  const unresolvedBlockerNames = blockers
    .filter((blocker) => !closedTaskStatuses.has(blocker.status))
    .map((blocker) => blocker.title);
  const missingBlockerIds = blockerIds.filter((blockerId) => !taskById.has(blockerId));
  const hasOpenBlockers =
    unresolvedBlockerNames.length > 0 || missingBlockerIds.length > 0;
  const isWaiting =
    hasOpenBlockers || (task.status === "BLOCKED" && blockerIds.length === 0);

  let label = "";

  if (unresolvedBlockerNames.length > 0) {
    label = `Waiting on ${unresolvedBlockerNames.join(", ")}`;
  } else if (missingBlockerIds.length > 0) {
    label = "Waiting on a missing task reference";
  } else if (blockerNames.length > 0) {
    label = "Blocker cleared";
  } else if (task.status === "BLOCKED") {
    label = "Waiting on blocker details";
  }

  return {
    blockerIds,
    blockerNames,
    isWaiting,
    label,
    missingBlockerIds,
    unresolvedBlockerNames,
  };
}

export function getTaskStaleness(
  task: { priority: string; status: string; updatedAt: Date | string },
  now = new Date(),
): TaskStaleness | null {
  if (closedTaskStatuses.has(task.status)) {
    return null;
  }

  const staleAfterDaysByStatus: Record<string, number> = {
    BACKLOG: 30,
    BLOCKED: 10,
    DOING: 7,
    TODO: 14,
  };
  const priorityAdjustment: Record<string, number> = {
    CRITICAL: -5,
    HIGH: -3,
    LOW: 7,
    MEDIUM: 0,
  };
  const staleAfterDays = Math.max(
    3,
    (staleAfterDaysByStatus[task.status] ?? 14) +
      (priorityAdjustment[task.priority] ?? 0),
  );
  const daysStale = daysSince(task.updatedAt, now);

  if (daysStale < staleAfterDays) {
    return null;
  }

  const action =
    task.status === "BACKLOG"
      ? "Revive it if it matters now, or archive it if it no longer belongs in the active system."
      : "Move it forward, park it in backlog, or archive it if it is no longer useful.";

  return {
    action,
    daysStale,
    label: `${daysStale} days without movement`,
    severity: daysStale >= staleAfterDays + 14 ? "high" : "medium",
  };
}
