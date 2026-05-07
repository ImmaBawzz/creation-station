import { describe, expect, it } from "vitest";

import { recommendNextTasks } from "@/lib/intelligence/prioritizer";
import type { IntelligenceTask } from "@/lib/intelligence/planner";

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
        category: "automation",
        id: "idea-a",
        tags: "",
        title: "Idea A",
      },
    },
    ...overrides,
  };
}

describe("recommendNextTasks", () => {
  it("returns an empty list when there is no eligible active work", () => {
    expect(
      recommendNextTasks(
        [
          task({ id: "done", status: "DONE" }),
          task({ id: "blocked", status: "BLOCKED" }),
        ],
        3,
        now,
      ),
    ).toEqual([]);
  });

  it("prioritizes active high-impact work over lower-priority work", () => {
    const recommendations = recommendNextTasks(
      [
        task({
          id: "low-todo",
          priority: "LOW",
          status: "TODO",
          title: "Low task",
        }),
        task({
          id: "critical-doing",
          priority: "CRITICAL",
          status: "DOING",
          title: "Critical task",
        }),
      ],
      2,
      now,
    );

    expect(recommendations.map((recommendedTask) => recommendedTask.id)).toEqual([
      "critical-doing",
      "low-todo",
    ]);
  });

  it("filters waiting TODO tasks but keeps waiting DOING tasks visible", () => {
    const recommendations = recommendNextTasks(
      [
        task({ id: "blocker", priority: "LOW", status: "TODO" }),
        task({
          blockers: [{ blockerTaskId: "blocker" }],
          id: "waiting-todo",
          priority: "CRITICAL",
          status: "TODO",
        }),
        task({
          blockers: [{ blockerTaskId: "blocker" }],
          id: "waiting-doing",
          priority: "HIGH",
          status: "DOING",
        }),
      ],
      3,
      now,
    );

    expect(recommendations.map((recommendedTask) => recommendedTask.id)).toContain(
      "waiting-doing",
    );
    expect(recommendations.map((recommendedTask) => recommendedTask.id)).not.toContain(
      "waiting-todo",
    );
  });

  it("diversifies across plan contexts by skipping repeated contexts before the final slot", () => {
    const recommendations = recommendNextTasks(
      [
        task({ id: "plan-a-1", priority: "CRITICAL", status: "TODO" }),
        task({ id: "plan-a-2", priority: "HIGH", status: "TODO" }),
        task({
          id: "plan-b-1",
          priority: "MEDIUM",
          status: "TODO",
          plan: {
            id: "plan-b",
            title: "Plan B",
            idea: { category: "game", tags: "", title: "Idea B" },
          },
        }),
      ],
      3,
      now,
    );

    expect(recommendations.map((recommendedTask) => recommendedTask.id)).toEqual([
      "plan-a-1",
      "plan-b-1",
    ]);
  });
});
