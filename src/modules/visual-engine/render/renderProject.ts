import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { readVisualProjectManifest, relativeProjectPath } from "@/modules/visual-engine/manifest";
import {
  getVisualProjectAssetFolders,
  getVisualProjectRoot,
  resolveVisualProjectPath,
} from "@/modules/visual-engine/paths";
import { validateVisualProjectById } from "@/modules/visual-engine/validate";
import type { VisualEngineRenderResult } from "@/modules/visual-engine/types";
import { packageProject } from "@/modules/visual-engine/export/packageProject";

const execFileAsync = promisify(execFile);

const DEFAULT_FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";
const DEFAULT_FFPROBE_PATH = process.env.FFPROBE_PATH ?? "ffprobe";
const DEFAULT_HEIGHT = 1080;
const DEFAULT_WIDTH = 1920;
const DEFAULT_FPS = 30;

type RenderProjectError = Error & {
  details?: string[];
  statusCode?: number;
};

function createRenderError(message: string, statusCode = 400, details?: string[]): RenderProjectError {
  const error = new Error(message) as RenderProjectError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function runCommand(executable: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(executable, args, {
      windowsHide: true,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "command failed";
    throw createRenderError(`FFmpeg pipeline failed: ${details}`, 500);
  }
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const result = await execFileAsync(
      DEFAULT_FFPROBE_PATH,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        audioPath,
      ],
      { windowsHide: true },
    );
    const duration = Number.parseFloat((result.stdout ?? "").trim());

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Invalid audio duration");
    }

    return duration;
  } catch (error) {
    throw createRenderError(
      `Could not inspect audio duration: ${error instanceof Error ? error.message : "ffprobe failed"}`,
      500,
    );
  }
}

async function renderLoopedVisual({
  audioDuration,
  outputPath,
  sourcePath,
  sourceType,
}: {
  audioDuration: number;
  outputPath: string;
  sourcePath: string;
  sourceType: "image" | "video";
}): Promise<void> {
  const args =
    sourceType === "video"
      ? [
          "-y",
          "-stream_loop",
          "-1",
          "-i",
          sourcePath,
          "-t",
          `${audioDuration}`,
          "-an",
          "-r",
          `${DEFAULT_FPS}`,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          outputPath,
        ]
      : [
          "-y",
          "-loop",
          "1",
          "-i",
          sourcePath,
          "-t",
          `${audioDuration}`,
          "-an",
          "-r",
          `${DEFAULT_FPS}`,
          "-vf",
          `scale=${DEFAULT_WIDTH}:${DEFAULT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${DEFAULT_WIDTH}:${DEFAULT_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          outputPath,
        ];

  await runCommand(DEFAULT_FFMPEG_PATH, args);
}

async function mergeAudioVideo({
  audioPath,
  outputPath,
  videoPath,
}: {
  audioPath: string;
  outputPath: string;
  videoPath: string;
}): Promise<void> {
  await runCommand(DEFAULT_FFMPEG_PATH, [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-shortest",
    "-r",
    `${DEFAULT_FPS}`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "320k",
    outputPath,
  ]);
}

export async function renderProject(projectId: string): Promise<VisualEngineRenderResult> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw createRenderError("Visual Engine project was not found.", 404);
  }

  const validation = await validateVisualProjectById(projectId);

  if (!validation) {
    throw createRenderError("Visual Engine project validation failed.", 404);
  }

  const renderBlockingErrors = validation.errors.filter(
    (error) => error !== "Missing image files" && error !== "Missing video files",
  );

  if (renderBlockingErrors.length > 0) {
    throw createRenderError("Project assets are not ready for rendering.", 400, renderBlockingErrors);
  }

  const primaryVideo = project.videoFiles[0] ?? null;
  const primaryImage = project.imageFiles[0] ?? null;

  if (!primaryVideo && !primaryImage) {
    throw createRenderError("Project needs at least one image or video file before rendering.", 400, [
      "Missing image files",
      "Missing video files",
    ]);
  }

  const projectRoot = getVisualProjectRoot(projectId);
  const folders = getVisualProjectAssetFolders(projectId);
  await mkdir(folders.renders, { recursive: true });
  await mkdir(folders.packages, { recursive: true });

  const audioPath = resolveVisualProjectPath(projectId, project.audioFile!);
  const sourcePath = primaryVideo
    ? resolveVisualProjectPath(projectId, primaryVideo)
    : resolveVisualProjectPath(projectId, primaryImage!);
  const sourceType = primaryVideo ? "video" : "image";
  const duration = await getAudioDuration(audioPath);
  const intermediateVisualPath = path.join(folders.renders, `${projectId}.visual.mp4`);
  const finalOutputPath = path.join(folders.renders, `${projectId}.final.mp4`);

  await renderLoopedVisual({
    audioDuration: duration,
    outputPath: intermediateVisualPath,
    sourcePath,
    sourceType,
  });

  await mergeAudioVideo({
    audioPath,
    outputPath: finalOutputPath,
    videoPath: intermediateVisualPath,
  });

  const packageResult = await packageProject(projectId, finalOutputPath);

  return {
    outputPath: relativeProjectPath(finalOutputPath),
    packagePath: packageResult.bundlePath,
    projectId,
    renderPath: relativeProjectPath(finalOutputPath),
  };
}
