import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { planFinalAssembly, readFinalAssemblyState } from "@/modules/final-assembly";
import { getVisualProjectRoot } from "@/modules/visual-engine/paths";

const createdRoots = new Set<string>();

async function createFixture() {
  const projectId = `final-assembly-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = getVisualProjectRoot(projectId);
  const audioDir = path.join(root, "audio");
  const imagesDir = path.join(root, "images");
  const lyricsDir = path.join(root, "lyrics");
  const videoDir = path.join(root, "video");

  await mkdir(audioDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });
  await mkdir(lyricsDir, { recursive: true });
  await mkdir(videoDir, { recursive: true });

  await writeFile(path.join(root, "project.json"), `${JSON.stringify({
    audioFile: `visual-workspace/projects/${projectId}/audio/song.wav`,
    createdAt: new Date().toISOString(),
    id: projectId,
    imageFiles: [
      `visual-workspace/projects/${projectId}/images/scene-001.png`,
      `visual-workspace/projects/${projectId}/images/scene-002.png`,
    ],
    kind: "music_video",
    lyricsFile: null,
    name: projectId,
    outputFolder: `visual-workspace/projects/${projectId}`,
    status: "ready",
    updatedAt: new Date().toISOString(),
    videoFiles: [],
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(audioDir, "song.wav"), "audio", "utf8");
  await writeFile(path.join(imagesDir, "scene-001.png"), "image-one", "utf8");
  await writeFile(path.join(imagesDir, "scene-002.png"), "image-two", "utf8");
  await writeFile(path.join(lyricsDir, "lyrics.json"), `${JSON.stringify({
    lines: [
      { end: 5.2, index: 0, start: 0, text: "Open the night", words: [{ end: 2.4, start: 0, text: "Open" }, { end: 5.2, start: 2.4, text: "the night" }] },
      { end: 10.4, index: 1, start: 5.2, text: "Raise the lights", words: [{ end: 7.6, start: 5.2, text: "Raise" }, { end: 10.4, start: 7.6, text: "the lights" }] },
    ],
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(lyricsDir, "timelinePlan.json"), `${JSON.stringify({
    climaxMap: [],
    createdAt: new Date().toISOString(),
    pacingMap: [],
    projectId,
    runtimeBalanceStrategy: "balanced",
    sceneSequencing: [
      {
        adjustedDuration: 5.2,
        cameraMovement: "Slow dolly through haze",
        climaxAssigned: false,
        endTime: 5.2,
        motionIntensity: "medium",
        originalDuration: 5.2,
        pacingScore: 0.55,
        sceneId: "scene-001",
        sectionKind: "build",
        sourceImage: `visual-workspace/projects/${projectId}/images/scene-001.png`,
        startTime: 0,
        transitionStyle: "cinematic fade",
      },
      {
        adjustedDuration: 5.1,
        cameraMovement: "Portrait drift on the chorus",
        climaxAssigned: true,
        endTime: 10.3,
        motionIntensity: "low",
        originalDuration: 5.1,
        pacingScore: 0.88,
        sceneId: "scene-002",
        sectionKind: "emotional-peak",
        sourceImage: `visual-workspace/projects/${projectId}/images/scene-002.png`,
        startTime: 5.2,
        transitionStyle: "soft dissolve",
      },
      {
        adjustedDuration: 5.1,
        cameraMovement: "Portrait drift on the chorus",
        climaxAssigned: true,
        endTime: 15.4,
        motionIntensity: "low",
        originalDuration: 5.1,
        pacingScore: 0.88,
        sceneId: "scene-002",
        sectionKind: "emotional-peak",
        sourceImage: `visual-workspace/projects/${projectId}/images/scene-002.png`,
        startTime: 10.3,
        transitionStyle: "soft dissolve",
      },
    ],
    sourceManifests: {
      lyricsTiming: `visual-workspace/projects/${projectId}/lyrics/lyrics.json`,
      sceneMotionPlan: `visual-workspace/projects/${projectId}/lyrics/sceneMotionPlan.json`,
      scenePlan: `visual-workspace/projects/${projectId}/lyrics/scenePlan.json`,
      sceneVideos: `visual-workspace/projects/${projectId}/lyrics/sceneVideos.json`,
      timelinePlan: `visual-workspace/projects/${projectId}/lyrics/timelinePlan.json`,
    },
    totalRuntime: 10.3,
    transitions: [],
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(lyricsDir, "providerExecutionPlan.json"), `${JSON.stringify({
    createdAt: new Date().toISOString(),
    estimatedTotalCost: 12.5,
    projectId,
    providerAllocation: [{ estimatedCost: 12.5, providerId: "local-mock", sceneIds: ["scene-001", "scene-002"] }],
    scenePlans: [
      { estimatedCost: 5, fallbackProviders: ["local-mock"], healthStatus: "online", primaryProvider: "local-mock", rankedProviders: [], reasons: ["fallback"], sceneId: "scene-001", sourceImage: `visual-workspace/projects/${projectId}/images/scene-001.png` },
      { estimatedCost: 7.5, fallbackProviders: ["local-mock"], healthStatus: "online", primaryProvider: "local-mock", rankedProviders: [], reasons: ["fallback"], sceneId: "scene-002", sourceImage: `visual-workspace/projects/${projectId}/images/scene-002.png` },
    ],
    sourceManifests: {
      providerExecutionPlan: `visual-workspace/projects/${projectId}/lyrics/providerExecutionPlan.json`,
      timelinePlan: `visual-workspace/projects/${projectId}/lyrics/timelinePlan.json`,
    },
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(lyricsDir, "sceneAssets.json"), `${JSON.stringify({
    approvedSceneIds: ["scene-001", "scene-002"],
    assets: [
      { attempts: 1, id: "scene-001", imagePath: `visual-workspace/projects/${projectId}/images/scene-001.png`, priority: "high", prompt: "scene one", retryLimit: 1, sceneId: "scene-001", status: "completed", workflowType: "flux-fast-concept" },
      { attempts: 1, id: "scene-002", imagePath: `visual-workspace/projects/${projectId}/images/scene-002.png`, priority: "low", prompt: "scene two", retryLimit: 1, sceneId: "scene-002", status: "completed", workflowType: "flux-fast-concept" },
    ],
    concurrency: 1,
    createdAt: new Date().toISOString(),
    negativePrompt: "",
    progress: { completed: 2, failed: 0, generating: 0, processed: 2, skipped: 0, total: 2 },
    projectId,
    status: "completed",
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(lyricsDir, "sceneVideos.json"), `${JSON.stringify({
    approvedSceneIds: ["scene-001", "scene-002"],
    createdAt: new Date().toISOString(),
    jobs: [
      { cameraDirection: "Slow dolly through haze", duration: 4.8, id: "scene-001", motionPrompt: "prompt", motionType: "cinematic-drift", provider: "mock", sceneId: "scene-001", sourceImage: `visual-workspace/projects/${projectId}/images/scene-001.png`, status: "completed" },
      { cameraDirection: "Portrait drift on the chorus", duration: 5.1, id: "scene-002", motionPrompt: "prompt", motionType: "steady-hold", provider: "mock", sceneId: "scene-002", sourceImage: `visual-workspace/projects/${projectId}/images/scene-002.png`, status: "completed" },
    ],
    progress: { completed: 2, failed: 0, pending: 0, processed: 2, running: 0, total: 2 },
    projectId,
    provider: "mock",
    sourceManifests: {
      sceneAssets: `visual-workspace/projects/${projectId}/lyrics/sceneAssets.json`,
      scenePlan: `visual-workspace/projects/${projectId}/lyrics/scenePlan.json`,
      sceneVideos: `visual-workspace/projects/${projectId}/lyrics/sceneVideos.json`,
    },
    status: "completed",
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");

  createdRoots.add(root);
  return { projectId, root };
}

afterEach(async () => {
  await Promise.all(
    [...createdRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      createdRoots.delete(root);
    }),
  );
});

describe("final assembly planning", () => {
  it("builds a resumable final assembly manifest from timeline and provider outputs", async () => {
    const fixture = await createFixture();
    const originalFfprobePath = process.env.FFPROBE_PATH;
    process.env.FFPROBE_PATH = path.join(process.cwd(), "tests", "fixtures", "missing-ffprobe.exe");

    try {
      await expect(planFinalAssembly(fixture.projectId)).rejects.toThrow("Could not inspect master audio duration");
    } finally {
      if (originalFfprobePath) {
        process.env.FFPROBE_PATH = originalFfprobePath;
      } else {
        delete process.env.FFPROBE_PATH;
      }
    }
  });
});