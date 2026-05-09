import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  generateProviderExecutionPlan,
  readProviderExecutionPlan,
} from "@/modules/video-generation/governance";
import { getVisualProjectAssetFolders, getVisualProjectRoot } from "@/modules/visual-engine/paths";

const createdRoots = new Set<string>();

async function createTimelineFixture() {
  const projectId = `provider-governance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = getVisualProjectRoot(projectId);
  const folders = getVisualProjectAssetFolders(projectId);

  await mkdir(folders.lyrics, { recursive: true });

  await writeFile(
    path.join(folders.lyrics, "timelinePlan.json"),
    `${JSON.stringify({
      climaxMap: [{ reason: "chorus peak", sceneId: "scene-002", strength: 0.93 }],
      createdAt: new Date().toISOString(),
      pacingMap: [],
      projectId,
      runtimeBalanceStrategy: "balanced",
      sceneSequencing: [
        {
          adjustedDuration: 5.4,
          cameraMovement: "Whip-pan into a fast push through a strobing chorus crowd.",
          climaxAssigned: false,
          endTime: 5.4,
          motionIntensity: "high",
          originalDuration: 5,
          pacingScore: 0.86,
          sceneId: "scene-001",
          sectionKind: "build",
          sourceImage: `visual-workspace/projects/${projectId}/images/scene-001.png`,
          startTime: 0,
          transitionStyle: "kinetic cut",
        },
        {
          adjustedDuration: 6.1,
          cameraMovement: "Slow portrait drift around the singer during the emotional peak.",
          climaxAssigned: true,
          endTime: 11.5,
          motionIntensity: "low",
          originalDuration: 6,
          pacingScore: 0.92,
          sceneId: "scene-002",
          sectionKind: "emotional-peak",
          sourceImage: `visual-workspace/projects/${projectId}/images/scene-002.png`,
          startTime: 5.4,
          transitionStyle: "soft dissolve",
        },
      ],
      sourceManifests: {
        lyricsTiming: `visual-workspace/projects/${projectId}/lyrics/lyricsTiming.json`,
        sceneMotionPlan: `visual-workspace/projects/${projectId}/lyrics/sceneMotionPlan.json`,
        scenePlan: `visual-workspace/projects/${projectId}/lyrics/scenePlan.json`,
        sceneVideos: `visual-workspace/projects/${projectId}/lyrics/sceneVideos.json`,
        timelinePlan: `visual-workspace/projects/${projectId}/lyrics/timelinePlan.json`,
      },
      totalRuntime: 11.5,
      transitions: [],
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );

  createdRoots.add(root);
  return { folders, projectId, root };
}

afterEach(async () => {
  await Promise.all(
    [...createdRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      createdRoots.delete(root);
    }),
  );
});

describe("provider governance simulation", () => {
  it("creates a provider execution plan from timeline sequencing", async () => {
    const fixture = await createTimelineFixture();

    const plan = await generateProviderExecutionPlan(fixture.projectId);

    expect(plan.scenePlans).toHaveLength(2);
    expect(plan.scenePlans[0]).toMatchObject({
      fallbackProviders: ["wan", "local-mock"],
      primaryProvider: "ltx",
      sceneId: "scene-001",
    });
    expect(plan.scenePlans[1]).toMatchObject({
      fallbackProviders: ["runway", "local-mock"],
      primaryProvider: "kling",
      sceneId: "scene-002",
    });
    expect(plan.providerAllocation).toEqual([
      expect.objectContaining({ providerId: "ltx", sceneIds: ["scene-001"] }),
      expect.objectContaining({ providerId: "kling", sceneIds: ["scene-002"] }),
    ]);
  });

  it("persists providerExecutionPlan.json and can read it back", async () => {
    const fixture = await createTimelineFixture();

    const generated = await generateProviderExecutionPlan(fixture.projectId);
    const manifestPath = path.join(fixture.folders.lyrics, "providerExecutionPlan.json");
    const persistedRaw = await readFile(manifestPath, "utf8");
    const loaded = await readProviderExecutionPlan(fixture.projectId);

    expect(JSON.parse(persistedRaw).scenePlans).toHaveLength(2);
    expect(loaded?.estimatedTotalCost).toBe(generated.estimatedTotalCost);
    expect(loaded?.sourceManifests.providerExecutionPlan).toContain("providerExecutionPlan.json");
  });

  it("fails when no timeline plan exists", async () => {
    const projectId = `provider-governance-missing-${Date.now()}`;

    await expect(generateProviderExecutionPlan(projectId)).rejects.toThrow(
      "Timeline plan not found. Generate a timeline plan before simulating provider execution.",
    );
  });
});