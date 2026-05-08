import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  readVisualProjectManifest,
  relativeProjectPath,
  resolveVisualProjectMedia,
} from "@/modules/visual-engine/manifest";
import {
  getVisualProjectAssetFolders,
  resolveVisualProjectPath,
} from "@/modules/visual-engine/paths";
import { validateVisualProjectById } from "@/modules/visual-engine/validate";
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
    const commandError = error as NodeJS.ErrnoException & { stderr?: string };

    if (commandError?.code === "ENOENT") {
      throw createRenderError(
        `FFmpeg is not available. Set FFMPEG_PATH to a valid executable before rendering.`,
        503,
        [`Missing executable: ${executable}`],
      );
    }

    const details = commandError?.stderr?.trim() || commandError?.message || "command failed";
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
    const probeError = error as NodeJS.ErrnoException & { stderr?: string };

    if (probeError?.code === "ENOENT") {
      throw createRenderError(
        `FFprobe is not available. Set FFPROBE_PATH to a valid executable before rendering.`,
        503,
        [`Missing executable: ${DEFAULT_FFPROBE_PATH}`],
      );
    }

    throw createRenderError(
      `Could not inspect audio duration: ${probeError?.stderr?.trim() || probeError?.message || "ffprobe failed"}`,
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

export async function renderProject(projectId: string) {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw createRenderError("Visual Engine project was not found.", 404);
  }

  const validation = await validateVisualProjectById(projectId);

  if (!validation) {
    throw createRenderError("Visual Engine project validation failed.", 404);
  }

  if (validation.errors.length > 0) {
    throw createRenderError("Project assets are not ready for rendering.", 400, validation.errors);
  }

  const resolvedMedia = await resolveVisualProjectMedia(projectId, project);

  if (!resolvedMedia.audioFile || !resolvedMedia.imageFile) {
    throw createRenderError("Project assets are not ready for rendering.", 400, [
      !resolvedMedia.audioFile ? "Missing audio file" : null,
      !resolvedMedia.imageFile ? "Missing image files" : null,
    ].filter((detail): detail is string => detail !== null));
  }

  const folders = getVisualProjectAssetFolders(projectId);
  await mkdir(folders.renders, { recursive: true });
  await mkdir(folders.packages, { recursive: true });

  const audioPath = resolveVisualProjectPath(projectId, resolvedMedia.audioFile);
  const sourcePath = resolveVisualProjectPath(projectId, resolvedMedia.imageFile);
  const duration = await getAudioDuration(audioPath);
  const intermediateVisualPath = path.join(folders.renders, `${projectId}.visual.mp4`);
  const finalOutputPath = path.join(folders.renders, "final.mp4");

  await renderLoopedVisual({
    audioDuration: duration,
    outputPath: intermediateVisualPath,
    sourcePath,
    sourceType: "image",
  });

  await mergeAudioVideo({
    audioPath,
    outputPath: finalOutputPath,
    videoPath: intermediateVisualPath,
  });
  await rm(intermediateVisualPath, { force: true });

  const packageResult = await packageProject(projectId, finalOutputPath, {
    duration: `${duration.toFixed(2)}s`,
    usedAudio: resolvedMedia.audioFile,
    usedImage: resolvedMedia.imageFile,
  });

  return {
    duration: `${duration.toFixed(2)}s`,
    outputPath: relativeProjectPath(finalOutputPath),
    packagePath: packageResult.packagePath,
    projectId,
    renderPath: relativeProjectPath(finalOutputPath),
    success: true,
    usedAudio: resolvedMedia.audioFile,
    usedImage: resolvedMedia.imageFile,
  };
}
