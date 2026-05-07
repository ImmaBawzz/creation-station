import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AssetPipelineAdapter,
  ComfyUIAdapter,
  FFmpegAdapter,
  generateCreativePrompts,
  loadCreativeRuntimeConfig,
  recoverFailedRender,
  runMusicVideoBuilderV1,
} from "@/lib/creative-execution";

function tempWorkspace(): string {
  return mkdtempSync(path.join(os.tmpdir(), "creation-station-creative-"));
}

describe("creative execution layer", () => {
  it("loads local creative runtime config from env with safe defaults", async () => {
    await expect(
      loadCreativeRuntimeConfig({
        env: {
          CREATION_STATION_COMFYUI_URL: "http://127.0.0.1:8188/",
          CREATION_STATION_FFMPEG_PATH: "C:\\tools\\ffmpeg.exe",
          CREATION_STATION_OUTPUT_DIR: "output\\runtime",
        },
      }),
    ).resolves.toMatchObject({
      comfyuiUrl: "http://127.0.0.1:8188",
      ffmpegPath: "C:\\tools\\ffmpeg.exe",
    });
  });

  it("reports unavailable ComfyUI before workflow execution can continue", async () => {
    const adapter = new ComfyUIAdapter({
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    await expect(
      adapter.submitWorkflow({
        workflow: {},
      }),
    ).rejects.toThrow("ComfyUI is unavailable");
  });

  it("reports missing ComfyUI nodes from object info", async () => {
    const adapter = new ComfyUIAdapter({
      fetchImpl: async () => new Response(JSON.stringify({ KSampler: {} })),
    });

    await expect(adapter.assertRequiredNodes(["KSampler", "VAELoader"])).rejects.toThrow(
      "ComfyUI is missing required nodes: VAELoader",
    );
  });

  it("rejects empty ComfyUI downloads as corrupted outputs", async () => {
    const adapter = new ComfyUIAdapter({
      fetchImpl: async () => new Response(new Uint8Array()),
    });
    const root = tempWorkspace();

    try {
      await expect(
        adapter.downloadOutput({
          output: {
            filename: "empty.mp4",
            subfolder: "",
            type: "output",
            url: "http://127.0.0.1:8188/view?filename=empty.mp4",
          },
          targetPath: path.join(root, "empty.mp4"),
        }),
      ).rejects.toThrow("ComfyUI output is empty or corrupted");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports missing ffmpeg before render execution", async () => {
    const root = tempWorkspace();
    const adapter = new FFmpegAdapter({
      executor: async () => {
        throw new Error("executor should not run when ffmpeg is missing");
      },
      ffmpegPath: path.join(root, "missing-ffmpeg.exe"),
    });

    try {
      const audioPath = path.join(root, "source", "audio.wav");
      const videoPath = path.join(root, "source", "visual.mp4");
      const outputPath = path.join(root, "renders", "final.mp4");
      mkdirSync(path.dirname(videoPath), { recursive: true });
      writeFileSync(audioPath, "audio", "utf8");
      writeFileSync(videoPath, "video", "utf8");

      await expect(
        adapter.mergeAudioVideo({
          audioPath,
          outputPath,
          videoPath,
        }),
      ).rejects.toThrow("FFmpeg is missing or not executable");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("recovers a failed render by moving the partial output and writing a manifest", async () => {
    const root = tempWorkspace();
    const outputPath = path.join(root, "renders", "final.mp4");

    try {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, "partial-render", "utf8");

      const recovery = await recoverFailedRender({
        outputPath,
        reason: "ffmpeg failed after writing partial output",
      });

      expect(recovery.recoveredPath).toContain(".failed");
      expect(() => readFileSync(outputPath, "utf8")).toThrow();
      expect(readFileSync(recovery.recoveredPath!, "utf8")).toBe("partial-render");
      expect(JSON.parse(readFileSync(recovery.manifestPath, "utf8"))).toMatchObject({
        originalOutputPath: outputPath,
        reason: "ffmpeg failed after writing partial output",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports missing source files before render execution", async () => {
    const root = tempWorkspace();
    const adapter = new FFmpegAdapter({
      executor: async () => {
        throw new Error("executor should not run when inputs are missing");
      },
    });

    try {
      const audioPath = path.join(root, "source", "missing.wav");
      const videoPath = path.join(root, "source", "visual.mp4");
      const outputPath = path.join(root, "renders", "final.mp4");
      mkdirSync(path.dirname(videoPath), { recursive: true });
      writeFileSync(videoPath, "video", "utf8");

      await expect(
        adapter.mergeAudioVideo({
          audioPath,
          outputPath,
          videoPath,
        }),
      ).rejects.toThrow(`Audio input is missing: ${audioPath}`);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("validates final render exports and prepares release packages", async () => {
    const root = tempWorkspace();
    const ffmpeg = new FFmpegAdapter();
    const assets = new AssetPipelineAdapter();
    const projectFolders = await assets.organizeProjectFolders({
      projectSlug: "Signal Fire",
      rootDir: root,
    });
    const renderPath = path.join(projectFolders.renders, "signal-fire.mp4");
    const promptPack = generateCreativePrompts({
      concept: "Neon performance video",
      title: "Signal Fire",
    });

    try {
      writeFileSync(renderPath, Buffer.from("....ftypmp42not-empty"));

      await expect(
        ffmpeg.validateExport({
          minBytes: 2,
          outputPath: renderPath,
        }),
      ).resolves.toMatchObject({
        errors: [],
        ok: true,
        outputPath: renderPath,
      });

      const release = await assets.prepareReleasePackage({
        manifest: { title: "Signal Fire" },
        projectDir: path.dirname(projectFolders.release),
        promptPack,
        renderPath,
      });
      const releaseFiles = await readdir(release.releaseDir);

      expect(release.files).toHaveLength(3);
      expect(releaseFiles).toEqual(
        expect.arrayContaining(["final-render.mp4", "manifest.json", "prompt-pack.json"]),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("runs Music Video Builder v1 with injected live adapters", async () => {
    const root = tempWorkspace();
    const audioPath = path.join(root, "source", "audio.wav");
    const comfyui = new ComfyUIAdapter({
      fetchImpl: async (url, init) => {
        const target = String(url);

        if (target.endsWith("/prompt") && init?.method === "POST") {
          return new Response(JSON.stringify({ prompt_id: "prompt-1" }));
        }

        if (target.includes("/history/prompt-1")) {
          return new Response(
            JSON.stringify({
              "prompt-1": {
                outputs: {
                  "9": {
                    videos: [{ filename: "visual.mp4", subfolder: "", type: "output" }],
                  },
                },
                status: { completed: true },
              },
            }),
          );
        }

        if (target.includes("/view?")) {
          return new Response(Buffer.from("....ftypmp42visual"));
        }

        return new Response("not found", { status: 404 });
      },
    });
    const ffmpeg = new FFmpegAdapter({
      executor: async (_executable, args) => {
        const outputPath = args.at(-1);

        if (outputPath) {
          writeFileSync(outputPath, Buffer.from("....ftypmp42final-render"));
        }

        return { stderr: "", stdout: "" };
      },
    });

    try {
      mkdirSync(path.dirname(audioPath), { recursive: true });
      writeFileSync(audioPath, "audio", "utf8");

      await expect(
        runMusicVideoBuilderV1({
          adapters: { comfyui, ffmpeg },
          config: {
            comfyuiUrl: "http://127.0.0.1:8188",
            ffmpegPath: "ffmpeg",
            outputDirectory: root,
          },
          input: {
            audioPath,
            durationSeconds: 12,
            title: "Signal Fire",
            visualPrompt: "Neon stage performance",
            workflow: { test: true },
          },
        }),
      ).resolves.toMatchObject({
        finalMp4Path: path.join(root, "signal-fire", "renders", "final.mp4"),
        promptId: "prompt-1",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
