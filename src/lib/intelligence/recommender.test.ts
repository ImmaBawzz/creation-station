import { describe, expect, it } from "vitest";

import { buildIntelligenceRecommendations } from "@/lib/intelligence/recommender";
import type { IntelligencePlan, IntelligenceTask } from "@/lib/intelligence/planner";
import type { IntelligenceIdea } from "@/lib/intelligence/router";

const now = new Date("2026-05-07T12:00:00.000Z");

function idea(overrides: Partial<IntelligenceIdea>): IntelligenceIdea {
  return {
    category: "music",
    id: "idea-a",
    rawText: "",
    status: "RAW",
    tags: "",
    title: "Idea A",
    ...overrides,
  };
}

function plan(overrides: Partial<IntelligencePlan>): IntelligencePlan {
  return {
    id: "plan-a",
    status: "REVIEW_PENDING",
    title: "Plan A",
    idea: {
      status: "PLANNED",
      title: "Idea A",
    },
    ...overrides,
  };
}

function task(overrides: Partial<IntelligenceTask>): IntelligenceTask {
  return {
    id: "task-a",
    priority: "MEDIUM",
    status: "TODO",
    title: "Task A",
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

describe("buildIntelligenceRecommendations", () => {
  it("returns no recommendations when there are no signals", () => {
    expect(
      buildIntelligenceRecommendations({
        ideas: [],
        reviewPlans: [],
        tasks: [],
        now,
      }),
    ).toEqual([]);
  });

  it("prioritizes cleared blockers ahead of revision, review, and next-task signals", () => {
    const recommendations = buildIntelligenceRecommendations({
      ideas: [idea({ id: "revision-idea", status: "NEEDS_REVISION", title: "Needs polish" })],
      reviewPlans: [plan({ id: "review-plan", title: "Reviewable plan" })],
      tasks: [
        task({ id: "blocker", status: "DONE", title: "Completed blocker" }),
        task({
          blockers: [{ blockerTaskId: "blocker" }],
          id: "blocked-cleared",
          status: "BLOCKED",
          title: "Blocked task",
        }),
      ],
      now,
    });

    expect(recommendations[0]).toMatchObject({
      id: "cleared-blocked-cleared",
      title: "Revive cleared work",
      tone: "blocked",
    });
    expect(recommendations.map((recommendation) => recommendation.id)).toContain(
      "revision-revision-idea",
    );
    expect(recommendations.map((recommendation) => recommendation.id)).toContain(
      "review-review-plan",
    );
  });

  it("deduplicates recommendations by context until the limit requires a repeated context", () => {
    const recommendations = buildIntelligenceRecommendations({
      ideas: [],
      limit: 2,
      reviewPlans: [],
      tasks: [
        task({
          id: "blocked-no-details",
          status: "BLOCKED",
          title: "Blocked without details",
        }),
        task({
          id: "next-task",
          priority: "CRITICAL",
          status: "DOING",
          title: "Next task",
        }),
      ],
      now,
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      "blocked-blocked-no-details",
      "next-next-task",
    ]);
  });

  it("creates a route recommendation for raw ideas with a non-general route", () => {
    const recommendations = buildIntelligenceRecommendations({
      ideas: [
        idea({
          category: "games",
          id: "game-idea",
          rawText: "Prototype a UEFN quest mechanic.",
          tags: "uefn",
          title: "Fortnite island",
        }),
      ],
      reviewPlans: [],
      tasks: [],
      now,
    });

    expect(recommendations).toEqual([
      {
        body: "Fortnite island looks like UEFN pipeline. Send it to the Factory with that route in mind.",
        href: "/factory",
        id: "route-game-idea",
        title: "Route the next idea",
        tone: "route",
      },
    ]);
  });

  it("respects the recommendation limit", () => {
    const recommendations = buildIntelligenceRecommendations({
      ideas: [
        idea({ id: "revision-idea", status: "NEEDS_REVISION", title: "Needs polish" }),
        idea({
          category: "visual art",
          id: "visual-idea",
          rawText: "Render a thumbnail image.",
          status: "RAW",
          tags: "image",
          title: "Visual concept",
        }),
      ],
      limit: 1,
      reviewPlans: [plan({ id: "review-plan", title: "Reviewable plan" })],
      tasks: [task({ id: "next-task", priority: "HIGH", status: "TODO" })],
      now,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].id).toBe("revision-revision-idea");
  });
});
