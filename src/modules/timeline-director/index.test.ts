import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateTimelinePlan, readTimelinePlan } from "@/modules/timeline-director";
import { getVisualProjectAssetFolders, getVisualProjectRoot } from "@/modules/visual-engine/paths";

const createdRoots = new Set<string>();

async function createTimelineFixture({
  lyricEnd = 17.2,
  videoDurations = [4, 4, 4],
}: {
  lyricEnd?: number;
  videoDurations?: number[];
} = {}) {
  const projectId = `timeline-director-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = getVisualProjectRoot(projectId);
  const folders = getVisualProjectAssetFolders(projectId);
  createdRoots.add(root);

  await mkdir(folders.images, { recursive: true });
  await mkdir(folders.lyrics, { recursive: true });
  await mkdir(folders.video, { recursive: true });

  const scenes = [
    {
      cameraDirection: "Slow dolly through drifting haze",
      emotionalTone: "anticipatory",
      endTime: 4,
      generationType: "intro",
      id: "scene-001",
      lyricSegment: "we rise before the light",
      priority: "low",
      startTime: 0,
      visualDescription: "A stage emerges from darkness.",
      workflowType: "flux-dev-cinematic",
    },
    {
      cameraDirection: "Fast push into the chorus crowd",
      emotionalTone: "surging",
      endTime: 8,
      generationType: "chorus",
      id: "scene-002",
      lyricSegment: "feel the drop break open now",
      priority: "high",
      startTime: 4,
      visualDescription: "Impact lights erupt across the crowd.",
      workflowType: "flux-fast-concept",
    },
    {
      cameraDirection: "Close portrait hold with soft breath",
      emotionalTone: "tender",
      endTime: 12,
      generationType: "lyric",
      id: "scene-003",
      lyricSegment: "hold my heart before it fades",
      priority: "high",
      startTime: 8,
      visualDescription: "A quiet emotional close-up.",
      workflowType: "flux-dev-cinematic",
    },
  ];

  for (const scene of scenes) {
    await writeFile(path.join(folders.images, `${scene.id}.png`), scene.id, "utf8");
  }

  await writeFile(
    path.join(folders.lyrics, "scenePlan.json"),
    `${JSON.stringify({ scenes }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(folders.lyrics, "sceneMotionPlan.json"),
    `${JSON.stringify({
      createdAt: new Date().toISOString(),
      projectId,
      scenes: scenes.map((scene, index) => ({
        cameraMovement: index === 1 ? "fast push with controlled shake burst" : "slow cinematic drift",
        duration: videoDurations[index] ?? 4,
        endFrameStrategy: "Resolve on a readable subject pose.",
        environmentalMovement: index === 1 ? "explosive particles" : "ambient haze",
        loopSuitability: index === 1 ? "low" : "high",
        motionIntensity: index === 1 ? "high" : index === 2 ? "medium" : "low",
        pacingScore: index === 1 ? 9 : index === 2 ? 7 : 4,
        providerCompatibilityTags: index === 1 ? ["wan-impact-cut", "kling-performance-ready"] : ["ltx-loop-safe", "wan-safe-drift"],
        sceneId: scene.id,
        sourceImage: `visual-workspace/projects/${projectId}/images/${scene.id}.png`,
        startFrameStrategy: "Lock the still composition before motion.",
        subjectMovement: index === 1 ? "impact hits" : "subtle performance gesture",
        templateKey: index === 1 ? "high-energy" : index === 2 ? "emotional" : "atmospheric",
        transitionType: index === 1 ? "aggressive cut transition" : "soft fade transition",
      })),
      sourceManifests: {
        sceneAssets: `visual-workspace/projects/${projectId}/lyrics/sceneAssets.json`,
        sceneMotionPlan: `visual-workspace/projects/${projectId}/lyrics/sceneMotionPlan.json`,
        scenePlan: `visual-workspace/projects/${projectId}/lyrics/scenePlan.json`,
      },
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(folders.lyrics, "sceneVideos.json"),
    `${JSON.stringify({
      approvedSceneIds: scenes.map((scene) => scene.id),
      createdAt: new Date().toISOString(),
      jobs: scenes.map((scene, index) => ({
        cameraDirection: scene.cameraDirection,
        completedAt: new Date().toISOString(),
        duration: videoDurations[index] ?? 4,
        id: scene.id,
        motionPrompt: "mock motion prompt",
        motionType: index === 1 ? "pulse-cut" : "cinematic-drift",
        placeholderVideoId: `mock-${scene.id}`,
        provider: "mock",
        sceneId: scene.id,
        sourceImage: `visual-workspace/projects/${projectId}/images/${scene.id}.png`,
        status: "completed",
      })),
      progress: {
        completed: scenes.length,
        failed: 0,
        pending: 0,
        processed: scenes.length,
        running: 0,
        total: scenes.length,
      },
      projectId,
      provider: "mock",
      sourceManifests: {
        sceneAssets: `visual-workspace/projects/${projectId}/lyrics/sceneAssets.json`,
        scenePlan: `visual-workspace/projects/${projectId}/lyrics/scenePlan.json`,
        sceneVideos: `visual-workspace/projects/${projectId}/lyrics/sceneVideos.json`,
      },
      status: "completed",
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(folders.lyrics, "lyrics-aligned.json"),
    `${JSON.stringify({
      alignedAt: new Date().toISOString(),
      lines: [
        { end: 4.2, index: 0, start: 0, text: "we rise before the light", words: [] },
        { end: 8.4, index: 1, start: 4.2, text: "feel the drop break open now", words: [] },
        { end: lyricEnd, index: 2, start: 8.4, text: "hold my heart before it fades", words: [] },
      ],
    }, null, 2)}\n`,
    "utf8",
  );

  return { projectId, root };
}

afterEach(async () => {
  await Promise.all([...createdRoots].map(async (root) => {
    await rm(root, { force: true, recursive: true });
    createdRoots.delete(root);
  }));
});

describe("timeline director", () => {
  it("generates a timeline plan", async () => {
    const fixture = await createTimelineFixture();

    const plan = await generateTimelinePlan(fixture.projectId);
    const persisted = await readTimelinePlan(fixture.projectId);

    expect(plan.sceneSequencing).toHaveLength(3);
    expect(plan.transitions.length).toBe(2);
    expect(persisted?.sourceManifests.timelinePlan).toContain("timelinePlan.json");
  });

  it("balances runtime by extending strongest scenes when the song runs longer", async () => {
    const fixture = await createTimelineFixture({ lyricEnd: 18.8, videoDurations: [3, 3, 3] });

    const plan = await generateTimelinePlan(fixture.projectId);

    expect(plan.runtimeBalanceStrategy).toBe("extended-strongest-scenes");
    expect(plan.totalRuntime).toBeGreaterThan(9);
  });

  it("balances runtime by compressing lower-priority scenes when runtime is too long", async () => {
    const fixture = await createTimelineFixture({ lyricEnd: 10.5, videoDurations: [5, 5, 5] });

    const plan = await generateTimelinePlan(fixture.projectId);

    expect(plan.runtimeBalanceStrategy).toBe("compressed-lower-priority");
    expect(plan.totalRuntime).toBeLessThan(15);
  });

  it("allocates climax scenes to drop and emotional peak moments", async () => {
    const fixture = await createTimelineFixture();

    const plan = await generateTimelinePlan(fixture.projectId);
    const climaxIds = plan.climaxMap.map((entry) => entry.sceneId);

    expect(climaxIds).toContain("scene-002");
    expect(climaxIds).toContain("scene-003");
  });

  it("diversifies repetitive transitions", async () => {
    const fixture = await createTimelineFixture();

    const plan = await generateTimelinePlan(fixture.projectId);
    const uniqueTransitions = new Set(plan.transitions.map((transition) => transition.transitionStyle));

    expect(uniqueTransitions.size).toBeGreaterThan(1);
  });

  it("writes the timeline manifest file", async () => {
    const fixture = await createTimelineFixture();

    await generateTimelinePlan(fixture.projectId);
    const source = await readFile(path.join(getVisualProjectAssetFolders(fixture.projectId).lyrics, "timelinePlan.json"), "utf8");

    expect(JSON.parse(source).sceneSequencing).toHaveLength(3);
  });
});