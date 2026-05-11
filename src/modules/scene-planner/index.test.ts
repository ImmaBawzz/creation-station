import { describe, expect, it } from "vitest";

import { buildScenePlan } from "@/modules/scene-planner";
import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";

function createLine(index: number, text: string, start: number, end: number): VisualEngineLyricsLine {
  return {
    end,
    index,
    start,
    text,
    words: [],
  };
}

describe("scene planner", () => {
  it("detects chorus repetition and routes high priority shots to cinematic", () => {
    const plan = buildScenePlan({
      duration: 42,
      lines: [
        createLine(0, "Hold the line tonight", 2, 5),
        createLine(1, "We are fire", 7, 10),
        createLine(2, "Hold the line tonight", 18, 21),
      ],
    });

    const chorusScenes = plan.scenes.filter((scene) => scene.generationType === "chorus");

    expect(chorusScenes.length).toBe(2);
    expect(chorusScenes.every((scene) => scene.priority === "high")).toBe(true);
    expect(chorusScenes.every((scene) => scene.workflowType === "flux-dev-cinematic")).toBe(true);
  });

  it("creates intro transition and outro scenes around silence gaps", () => {
    const plan = buildScenePlan({
      duration: 24,
      lines: [
        createLine(0, "Into the blue", 4, 6),
        createLine(1, "Echo in the hall", 10, 12),
      ],
    });

    expect(plan.scenes[0]?.generationType).toBe("intro");
    expect(plan.scenes.some((scene) => scene.generationType === "transition")).toBe(true);
    expect(plan.scenes.at(-1)?.generationType).toBe("outro");
  });
});
