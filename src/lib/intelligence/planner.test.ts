import { describe, expect, it } from "vitest";

import {
  buildTaskMomentumContext,
  planContextKey,
  type IntelligenceTask,
} from "@/lib/intelligence/planner";

const now = new Date("2026-05-07T12:00:00.000Z");

function task(overrides: Partial<IntelligenceTask>): IntelligenceTask {
  return {
    id: "task",
    priority: "MEDIUM",
    status: "TODO",
    title: "Task",
    updatedAt: "2026-05-06T12:00:00.000Z",
    plan: {
      id: "plan-a",
      title: "Plan A",
      idea: {
        category: "music",
        id: "idea-a",
        tags: "",
        title: "Idea A",
      },
    },
    ...overrides,
  };
}

describe("planContextKey", () => {
  it("uses plan id when present and falls back to title", () => {
    expect(planContextKey(task({ plan: { ...task({}).plan, id: "plan-id" } }))).toBe(
      "plan-id",
    );
    expect(
      planContextKey(
        task({
          plan: {
            title: "Untitled plan key",
            idea: { category: "music", tags: "", title: "Idea" },
          },
        }),
      ),
    ).toBe("Untitled plan key");
  });
});

describe("buildTaskMomentumContext", () => {
  it("counts active TODO and DOING tasks by plan and tracks latest active age", () => {
    const context = buildTaskMomentumContext(
      [
        task({ id: "task-1", status: "TODO", updatedAt: "2026-05-06T12:00:00.000Z" }),
        task({ id: "task-2", status: "DOING", updatedAt: "2026-05-04T12:00:00.000Z" }),
        task({ id: "task-3", status: "DONE", updatedAt: "2026-05-07T12:00:00.000Z" }),
      ],
      now,
    );

    expect(context.activeTaskCount).toBe(2);
    expect(context.latestActiveDays).toBe(1);
    expect(context.planActiveCounts.get("plan-a")).toBe(2);
    expect(context.planLatestActiveDays.get("plan-a")).toBe(1);
  });

  it("records dependency impact for tasks that block waiting work", () => {
    const context = buildTaskMomentumContext(
      [
        task({ id: "blocker", title: "Blocking task", status: "TODO" }),
        task({
          blockers: [{ blockerTaskId: "blocker" }],
          id: "waiting",
          status: "TODO",
          title: "Waiting task",
        }),
      ],
      now,
    );

    expect(context.blockerImpactByTaskId.get("blocker")).toBe(1);
  });

  it("returns zero latest active days when there is no active work", () => {
    const context = buildTaskMomentumContext(
      [task({ id: "done", status: "DONE" })],
      now,
    );

    expect(context.activeTaskCount).toBe(0);
    expect(context.latestActiveDays).toBe(0);
  });
});
