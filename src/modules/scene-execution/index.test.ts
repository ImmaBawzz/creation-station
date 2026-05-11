import { describe, expect, it } from "vitest";

import { executeSceneAssetWithRetry, readSceneExecutionState } from "@/modules/scene-execution";
import type { SceneExecutionAsset } from "@/modules/scene-execution";

function createAsset(overrides: Partial<SceneExecutionAsset> = {}): SceneExecutionAsset {
  return {
    attempts: 1,
    id: "scene-001",
    priority: "high",
    prompt: "test prompt",
    retryLimit: 1,
    sceneId: "scene-001",
    status: "generating",
    workflowType: "flux-dev-cinematic",
    ...overrides,
  };
}

describe("scene execution", () => {
  it("retries a failed scene once and then completes", async () => {
    let invocationCount = 0;

    const result = await executeSceneAssetWithRetry({
      asset: createAsset(),
      executeScene: async () => {
        invocationCount += 1;

        if (invocationCount === 1) {
          throw new Error("temporary failure");
        }

        return {
          imagePath: "images/scene-001.png",
          manifestPath: "visual-workspace/projects/demo/project.json",
          promptId: "prompt-001",
        };
      },
      validateScene: async () => null,
    });

    expect(invocationCount).toBe(2);
    expect(result.attempts).toBe(2);
    expect(result.status).toBe("completed");
  });

  it("skips a scene when workflow validation fails", async () => {
    const result = await executeSceneAssetWithRetry({
      asset: createAsset({ attempts: 1, status: "generating" }),
      executeScene: async () => {
        throw new Error("should not run");
      },
      validateScene: async () => "workflow validation failed",
    });

    expect(result.status).toBe("skipped");
    expect(result.error).toContain("workflow validation failed");
  });
});
