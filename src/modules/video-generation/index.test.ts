import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getSceneVideoGenerationState,
  planSceneVideos,
  runSceneVideoGeneration,
} from "@/modules/video-generation";
import {
  getSceneVideosManifestPath,
  readSceneVideoState,
  writeSceneVideoState,
} from "@/modules/video-generation/sceneVideoManifest";
import { getVisualProjectAssetFolders, getVisualProjectRoot } from "@/modules/visual-engine/paths";

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForCompletedState(projectId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await getSceneVideoGenerationState(projectId);

    if (state?.status === "completed") {
      return state;
    }

    await wait(10);
  }

  throw new Error("Timed out waiting for completed scene video state.");
}

async function createProjectFixture({
  approvedSceneIds = ["scene-001", "scene-002"],
  includeSceneAssets = true,
  includeScenePlan = true,
}: {
  approvedSceneIds?: string[];
  includeSceneAssets?: boolean;
  includeScenePlan?: boolean;
}) {
  const projectId = `video-generation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = getVisualProjectRoot(projectId);
  const folders = getVisualProjectAssetFolders(projectId);

  await mkdir(folders.images, { recursive: true });
  await mkdir(folders.lyrics, { recursive: true });
  await mkdir(folders.video, { recursive: true });

  const imagePaths = [
    `visual-workspace/projects/${projectId}/images/scene-001.png`,
    `visual-workspace/projects/${projectId}/images/scene-002.png`,
  ];

  await writeFile(path.join(folders.images, "scene-001.png"), "image-001", "utf8");
  await writeFile(path.join(folders.images, "scene-002.png"), "image-002", "utf8");

  if (includeSceneAssets) {
    await writeFile(
      path.join(folders.lyrics, "sceneAssets.json"),
      `${JSON.stringify({
        approvedSceneIds,
        assets: [
          {
            attempts: 1,
            id: "scene-001",
            imagePath: imagePaths[0],
            priority: "high",
            prompt: "scene one",
            retryLimit: 1,
            sceneId: "scene-001",
            status: "completed",
            workflowType: "flux-dev-cinematic",
          },
          {
            attempts: 1,
            id: "scene-002",
            imagePath: imagePaths[1],
            priority: "low",
            prompt: "scene two",
            retryLimit: 1,
            sceneId: "scene-002",
            status: "completed",
            workflowType: "flux-fast-concept",
          },
        ],
        concurrency: 1,
        createdAt: new Date().toISOString(),
        negativePrompt: "",
        progress: {
          completed: 2,
          failed: 0,
          generating: 0,
          processed: 2,
          skipped: 0,
          total: 2,
        },
        projectId,
        status: "completed",
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      "utf8",
    );
  }

  if (includeScenePlan) {
    await writeFile(
      path.join(folders.lyrics, "scenePlan.json"),
      `${JSON.stringify({
        scenes: [
          {
            cameraDirection: "Slow dolly forward through stage haze.",
            emotionalTone: "anticipatory",
            endTime: 4,
            generationType: "intro",
            id: "scene-001",
            lyricSegment: "Open the night",
            priority: "high",
            startTime: 0,
            visualDescription: "A singer emerges from silhouette.",
            workflowType: "flux-dev-cinematic",
          },
          {
            cameraDirection: "Fast lateral sweep across the chorus crowd.",
            emotionalTone: "surging",
            endTime: 8,
            generationType: "chorus",
            id: "scene-002",
            lyricSegment: "Raise the lights",
            priority: "low",
            startTime: 4,
            visualDescription: "Hands rise into a strobing chorus moment.",
            workflowType: "flux-fast-concept",
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
  }

  return { folders, projectId, root };
}

const createdRoots = new Set<string>();

beforeEach(() => {
  process.env.SCENE_VIDEO_MOCK_DELAY_MS = "1";
});

afterEach(async () => {
  delete process.env.SCENE_VIDEO_MOCK_DELAY_MS;

  await Promise.all(
    [...createdRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      createdRoots.delete(root);
    }),
  );
});

describe("video generation orchestration", () => {
  it("creates a video plan from scene assets", async () => {
    const fixture = await createProjectFixture({});
    createdRoots.add(fixture.root);

    const state = await planSceneVideos(fixture.projectId);

    expect(state.status).toBe("idle");
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs[0]).toMatchObject({
      cameraDirection: "Slow dolly forward through stage haze.",
      provider: "mock",
      sceneId: "scene-001",
      sourceImage: `visual-workspace/projects/${fixture.projectId}/images/scene-001.png`,
      status: "pending",
    });
    expect(state.jobs[1]?.motionType).toBe("pulse-cut");
  });

  it("rejects missing scene assets", async () => {
    const fixture = await createProjectFixture({ includeSceneAssets: false });
    createdRoots.add(fixture.root);

    await expect(planSceneVideos(fixture.projectId)).rejects.toThrow(
      "Scene image assets not found. Generate approved scene images before planning scene videos.",
    );
  });

  it("rejects missing scene plan", async () => {
    const fixture = await createProjectFixture({ includeScenePlan: false });
    createdRoots.add(fixture.root);

    await expect(planSceneVideos(fixture.projectId)).rejects.toThrow(
      "Scene plan not found. Generate a scene plan before planning scene videos.",
    );
  });

  it("progresses the queue and writes completed placeholder records without real video files", async () => {
    const fixture = await createProjectFixture({});
    createdRoots.add(fixture.root);

    await planSceneVideos(fixture.projectId);
    const started = await runSceneVideoGeneration(fixture.projectId);

    expect(started.status).toBe("running");

    const completed = await waitForCompletedState(fixture.projectId);

    expect(completed.jobs.every((job) => job.status === "completed")).toBe(true);
    expect(completed.jobs.every((job) => typeof job.placeholderVideoId === "string")).toBe(true);
    expect(await readdir(fixture.folders.video)).toHaveLength(0);
  });

  it("allows resume after an interrupted queue", async () => {
    const fixture = await createProjectFixture({});
    createdRoots.add(fixture.root);

    const planned = await planSceneVideos(fixture.projectId);

    await writeSceneVideoState({
      ...planned,
      jobs: planned.jobs.map((job, index) => ({
        ...job,
        startedAt: index === 0 ? new Date().toISOString() : undefined,
        status: index === 0 ? "running" : "pending",
      })),
      status: "running",
    });

    const recovered = await getSceneVideoGenerationState(fixture.projectId);

    expect(recovered?.status).toBe("paused");
    expect(recovered?.jobs[0]?.status).toBe("pending");

    await runSceneVideoGeneration(fixture.projectId);
    const completed = await waitForCompletedState(fixture.projectId);

    expect(completed.jobs.every((job) => job.status === "completed")).toBe(true);
  });

  it("creates the sceneVideos manifest file", async () => {
    const fixture = await createProjectFixture({});
    createdRoots.add(fixture.root);

    await planSceneVideos(fixture.projectId);

    const manifestPath = getSceneVideosManifestPath(fixture.projectId);
    const manifestSource = await readFile(manifestPath, "utf8");
    const persisted = await readSceneVideoState(fixture.projectId);

    expect(JSON.parse(manifestSource).jobs).toHaveLength(2);
    expect(persisted?.sourceManifests.sceneVideos).toContain("sceneVideos.json");
  });
});