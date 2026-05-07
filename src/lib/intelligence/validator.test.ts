import { describe, expect, it } from "vitest";

import {
  daysSince,
  getTaskStaleness,
  getTaskWaitingState,
  taskBlockerReferenceIds,
} from "@/lib/intelligence/validator";

const now = new Date("2026-05-07T12:00:00.000Z");

describe("daysSince", () => {
  it("returns whole elapsed days and clamps future dates to zero", () => {
    expect(daysSince("2026-05-05T11:00:00.000Z", now)).toBe(2);
    expect(daysSince("2026-05-08T12:00:00.000Z", now)).toBe(0);
  });

  it("treats invalid dates as zero days old", () => {
    expect(daysSince("not-a-date", now)).toBe(0);
  });
});

describe("taskBlockerReferenceIds", () => {
  it("prefers persisted blocker records over label metadata", () => {
    expect(
      taskBlockerReferenceIds({
        blockers: [{ blockerTaskId: "persisted-blocker" }],
        labels: JSON.stringify({ blockedByTaskIds: ["label-blocker"], labels: [] }),
      }),
    ).toEqual(["persisted-blocker"]);
  });

  it("falls back to task label metadata when persisted blocker records are absent", () => {
    expect(
      taskBlockerReferenceIds({
        labels: JSON.stringify({ blockedByTaskIds: ["label-blocker"], labels: [] }),
      }),
    ).toEqual(["label-blocker"]);
  });
});

describe("getTaskWaitingState", () => {
  it("marks a task as waiting on unresolved blockers", () => {
    const task = {
      blockers: [{ blockerTaskId: "task-a" }],
      id: "task-b",
      status: "TODO",
      title: "Build feature",
    };

    expect(
      getTaskWaitingState(task, [
        { id: "task-a", status: "TODO", title: "Define scope" },
        task,
      ]),
    ).toMatchObject({
      blockerIds: ["task-a"],
      isWaiting: true,
      label: "Waiting on Define scope",
      unresolvedBlockerNames: ["Define scope"],
    });
  });

  it("reports missing blocker references", () => {
    expect(
      getTaskWaitingState(
        {
          blockers: [{ blockerTaskId: "missing-task" }],
          id: "task-b",
          status: "TODO",
          title: "Build feature",
        },
        [{ id: "task-b", status: "TODO", title: "Build feature" }],
      ),
    ).toMatchObject({
      isWaiting: true,
      label: "Waiting on a missing task reference",
      missingBlockerIds: ["missing-task"],
    });
  });

  it("distinguishes cleared blockers from blocked tasks with no blocker details", () => {
    expect(
      getTaskWaitingState(
        {
          blockers: [{ blockerTaskId: "task-a" }],
          id: "task-b",
          status: "BLOCKED",
          title: "Resume work",
        },
        [
          { id: "task-a", status: "DONE", title: "Define scope" },
          { id: "task-b", status: "BLOCKED", title: "Resume work" },
        ],
      ),
    ).toMatchObject({
      isWaiting: false,
      label: "Blocker cleared",
    });

    expect(
      getTaskWaitingState(
        { id: "task-c", status: "BLOCKED", title: "Blocked without detail" },
        [{ id: "task-c", status: "BLOCKED", title: "Blocked without detail" }],
      ),
    ).toMatchObject({
      isWaiting: true,
      label: "Waiting on blocker details",
    });
  });
});

describe("getTaskStaleness", () => {
  it("returns null for closed or fresh tasks", () => {
    expect(
      getTaskStaleness(
        { priority: "HIGH", status: "DONE", updatedAt: "2026-03-01T00:00:00.000Z" },
        now,
      ),
    ).toBeNull();

    expect(
      getTaskStaleness(
        { priority: "MEDIUM", status: "TODO", updatedAt: "2026-05-01T00:00:00.000Z" },
        now,
      ),
    ).toBeNull();
  });

  it("flags stale work with priority-adjusted severity", () => {
    expect(
      getTaskStaleness(
        { priority: "CRITICAL", status: "TODO", updatedAt: "2026-04-01T00:00:00.000Z" },
        now,
      ),
    ).toEqual({
      action:
        "Move it forward, park it in backlog, or archive it if it is no longer useful.",
      daysStale: 36,
      label: "36 days without movement",
      severity: "high",
    });
  });
});
