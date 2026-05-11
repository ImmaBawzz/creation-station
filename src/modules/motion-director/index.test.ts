import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildProviderCompatibilityTags,
  generateSceneMotionPlan,
  getSceneMotionPlanPath,
  readSceneMotionPlan,
  selectMotionTemplate,
} from "@/modules/motion-director";
import { resolveMotionIntensity } from "@/modules/motion-director/motionIntensity";
import type { ScenePlanScene } from "@/modules/scene-planner";
import { getVisualProjectAssetFolders, getVisualProjectRoot } from "@/modules/visual-engine/paths";

const createdRoots = new Set<string>();

async function createFixture(scenes: ScenePlanScene[]) {
  const projectId = `motion-director-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = getVisualProjectRoot(projectId);
  const folders = getVisualProjectAssetFolders(projectId);
  createdRoots.add(root);

  await mkdir(folders.images, { recursive: true });
  await mkdir(folders.lyrics, { recursive: true });

  for (const scene of scenes) {
    await writeFile(path.join(folders.images, `${scene.id}.png`), scene.id, "utf8");
  }

  await writeFile(
    path.join(folders.lyrics, "scenePlan.json"),
    `${JSON.stringify({ scenes }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(folders.lyrics, "sceneAssets.json"),
    `${JSON.stringify({
      approvedSceneIds: scenes.map((scene) => scene.id),
      assets: scenes.map((scene) => ({
        attempts: 1,
        id: scene.id,
        imagePath: `visual-workspace/projects/${projectId}/images/${scene.id}.png`,
        priority: scene.priority,
        prompt: scene.visualDescription,
        retryLimit: 1,
        sceneId: scene.id,
        status: "completed",
        workflowType: scene.workflowType,
      })),
      concurrency: 1,
      createdAt: new Date().toISOString(),
      negativePrompt: "",
      progress: {
        completed: scenes.length,
        failed: 0,
        generating: 0,
        processed: scenes.length,
        skipped: 0,
        total: scenes.length,
      },
      projectId,
      status: "completed",
      updatedAt: new Date().toISOString(),
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

describe("motion director", () => {
  it("selects high-energy for impact sections and atmospheric as fallback", () => {
    const highEnergyScene: ScenePlanScene = {
      cameraDirection: "Fast push through the crowd",
      emotionalTone: "surging",
      endTime: 6,
      generationType: "chorus",
      id: "scene-001",
      lyricSegment: "Feel the drop hit now",
      priority: "high",
      startTime: 0,
      visualDescription: "An explosion of light and impact.",
      workflowType: "flux-dev-cinematic",
    };
    const fallbackScene: ScenePlanScene = {
      cameraDirection: "Wide environment drift",
      emotionalTone: "open",
      endTime: 12,
      generationType: "transition",
      id: "scene-002",
      lyricSegment: "",
      priority: "low",
      startTime: 6,
      visualDescription: "Fog passes over distant lights.",
      workflowType: "flux-fast-concept",
    };

    expect(selectMotionTemplate(highEnergyScene)).toBe("high-energy");
    expect(selectMotionTemplate(fallbackScene)).toBe("atmospheric");
  });

  it("selects emotional when lyrics and tone indicate intimacy", () => {
    const scene: ScenePlanScene = {
      cameraDirection: "Close framing on the face",
      emotionalTone: "tender",
      endTime: 4,
      generationType: "lyric",
      id: "scene-003",
      lyricSegment: "hold my broken heart tonight",
      priority: "high",
      startTime: 0,
      visualDescription: "Quiet tears gather in the light.",
      workflowType: "flux-dev-cinematic",
    };

    expect(selectMotionTemplate(scene)).toBe("emotional");
  });

  it("generates a cinematic motion plan and writes the manifest", async () => {
    const fixture = await createFixture([
      {
        cameraDirection: "Slow dolly toward the singer",
        emotionalTone: "tender",
        endTime: 4,
        generationType: "lyric",
        id: "scene-001",
        lyricSegment: "hold my heart in the blue light",
        priority: "high",
        startTime: 0,
        visualDescription: "A singer in soft spotlight with floating particles.",
        workflowType: "flux-dev-cinematic",
      },
      {
        cameraDirection: "Orbit around a silhouette reveal",
        emotionalTone: "anticipatory",
        endTime: 8,
        generationType: "intro",
        id: "scene-002",
        lyricSegment: "step into the light",
        priority: "low",
        startTime: 4,
        visualDescription: "A silhouette reveal opens into a wide stage.",
        workflowType: "flux-fast-concept",
      },
    ]);

    const plan = await generateSceneMotionPlan(fixture.projectId);
    const persisted = await readSceneMotionPlan(fixture.projectId);
    const manifest = JSON.parse(await readFile(getSceneMotionPlanPath(fixture.projectId), "utf8")) as { scenes: unknown[] };

    expect(plan.scenes).toHaveLength(2);
    expect(plan.scenes[0]).toMatchObject({
      motionIntensity: "low",
      sceneId: "scene-001",
      templateKey: "emotional",
      transitionType: "soft fade transition",
    });
    expect(plan.scenes[1]?.templateKey).toBe("reveal");
    expect(manifest.scenes).toHaveLength(2);
    expect(persisted?.sourceManifests.sceneMotionPlan).toContain("sceneMotionPlan.json");
  });

  it("builds compatibility tags for reveal and high-energy sections", () => {
    const revealTags = buildProviderCompatibilityTags("reveal", resolveMotionIntensity({
      cameraDirection: "Orbit reveal",
      emotionalTone: "anticipatory",
      endTime: 4,
      generationType: "intro",
      id: "scene-004",
      lyricSegment: "show the light",
      priority: "high",
      startTime: 0,
      visualDescription: "An orbit reveal opens the world.",
      workflowType: "flux-dev-cinematic",
    }, "reveal"));
    const impactTags = buildProviderCompatibilityTags("high-energy", resolveMotionIntensity({
      cameraDirection: "Fast push",
      emotionalTone: "surging",
      endTime: 4,
      generationType: "peak",
      id: "scene-005",
      lyricSegment: "drop it now",
      priority: "high",
      startTime: 0,
      visualDescription: "Impact burst across the frame.",
      workflowType: "flux-dev-cinematic",
    }, "high-energy"));

    expect(revealTags).toContain("ltx-parallax-ready");
    expect(impactTags).toContain("wan-impact-cut");
    expect(impactTags).toContain("kling-performance-ready");
  });
});