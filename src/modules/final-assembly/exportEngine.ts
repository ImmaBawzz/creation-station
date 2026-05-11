import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildClipFilter } from "@/modules/final-assembly/transitionEngine";
import type {
  FinalAssemblyExportArtifact,
  FinalAssemblyRenderProfile,
  FinalAssemblyScene,
  FinalAssemblySubtitleArtifact,
} from "@/modules/final-assembly/types";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { resolveVisualProjectPath } from "@/modules/visual-engine/paths";

const execFileAsync = promisify(execFile);
const DEFAULT_FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";
const DEFAULT_FPS = 30;
const MASTER_WIDTH = 1920;
const MASTER_HEIGHT = 1080;

type ExportEngineError = Error & {
  details?: string[];
  statusCode?: number;
};

function createExportEngineError(message: string, statusCode = 400, details?: string[]): ExportEngineError {
  const error = new Error(message) as ExportEngineError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

async function runFfmpeg(args: string[]) {
  try {
    await execFileAsync(DEFAULT_FFMPEG_PATH, args, { windowsHide: true });
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & { stderr?: string };

    if (commandError.code === "ENOENT") {
      throw createExportEngineError("FFmpeg is not available. Set FFMPEG_PATH to a valid executable before final assembly.", 503);
    }

    throw createExportEngineError(
      `FFmpeg export failed: ${commandError.stderr?.trim() || commandError.message || "command failed"}`,
      500,
    );
  }
}

function buildScaleFilter(width: number, height: number): string {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}

async function renderClip(
  scene: FinalAssemblyScene,
  outputPath: string,
): Promise<void> {
  const absoluteSourcePath = resolveVisualProjectPath(process.cwd(), scene.sourcePath);
  const baseFilter = `fps=${DEFAULT_FPS},${buildScaleFilter(MASTER_WIDTH, MASTER_HEIGHT)}`;
  const transitionFilter = buildClipFilter(scene);
  const vf = transitionFilter ? `${baseFilter},${transitionFilter}` : baseFilter;

  const args = scene.sourceKind === "scene-video"
    ? [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        absoluteSourcePath,
        "-t",
        `${scene.correctedDuration}`,
        "-an",
        "-vf",
        vf,
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
        absoluteSourcePath,
        "-t",
        `${scene.correctedDuration}`,
        "-an",
        "-vf",
        vf,
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
      ];

  await runFfmpeg(args);
}

export async function renderMasterAssembly({
  projectId,
  scenes,
  workingDirectory,
}: {
  projectId: string;
  scenes: FinalAssemblyScene[];
  workingDirectory: string;
}): Promise<string> {
  await rm(workingDirectory, { force: true, recursive: true });
  await mkdir(workingDirectory, { recursive: true });

  const clipPaths: string[] = [];

  for (const scene of scenes) {
    const clipPath = path.join(workingDirectory, `${String(scene.timelineOrder).padStart(3, "0")}-${scene.sceneId}.mp4`);
    await renderClip(scene, clipPath);
    clipPaths.push(clipPath);
  }

  const concatListPath = path.join(workingDirectory, "concat.txt");
  await writeFile(concatListPath, `${clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "''")}'`).join("\n")}\n`, "utf8");

  const assembledVideoPath = path.join(workingDirectory, `${projectId}.assembled.mp4`);
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c",
    "copy",
    assembledVideoPath,
  ]);

  return assembledVideoPath;
}

function escapeSubtitlePath(subtitlePath: string): string {
  return subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

async function exportLyricOnlyProfile({
  audioPath,
  outputPath,
  profile,
  subtitlePath,
}: {
  audioPath: string;
  outputPath: string;
  profile: FinalAssemblyRenderProfile;
  subtitlePath: string;
}) {
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${profile.width}x${profile.height}:r=${DEFAULT_FPS}`,
    "-i",
    audioPath,
    "-vf",
    `subtitles='${escapeSubtitlePath(subtitlePath)}'`,
    "-shortest",
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

async function exportVisualProfile({
  assembledVideoPath,
  audioPath,
  outputPath,
  profile,
  subtitlePath,
}: {
  assembledVideoPath: string;
  audioPath: string;
  outputPath: string;
  profile: FinalAssemblyRenderProfile;
  subtitlePath: string;
}) {
  const scaleFilter = buildScaleFilter(profile.width, profile.height);
  const filters = [scaleFilter, `subtitles='${escapeSubtitlePath(subtitlePath)}'`];
  const args = [
    "-y",
    "-i",
    assembledVideoPath,
    "-i",
    audioPath,
    "-vf",
    filters.join(","),
  ];

  if (profile.clipDurationLimit) {
    args.push("-t", `${profile.clipDurationLimit}`);
  }

  args.push(
    "-shortest",
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
  );

  await runFfmpeg(args);
}

export async function exportAssemblyProfiles({
  assembledVideoPath,
  audioPath,
  exportDirectory,
  profiles,
  subtitleArtifacts,
}: {
  assembledVideoPath: string;
  audioPath: string;
  exportDirectory: string;
  profiles: FinalAssemblyRenderProfile[];
  subtitleArtifacts: FinalAssemblySubtitleArtifact[];
}): Promise<FinalAssemblyExportArtifact[]> {
  await mkdir(exportDirectory, { recursive: true });
  const subtitleByMode = new Map(subtitleArtifacts.map((artifact) => [artifact.mode, artifact]));
  const artifacts: FinalAssemblyExportArtifact[] = [];

  for (const profile of profiles) {
    const subtitleArtifact = subtitleByMode.get(profile.subtitleMode);

    if (!subtitleArtifact) {
      throw createExportEngineError(`Subtitle artifact for ${profile.subtitleMode} was not generated.`, 500);
    }

    const outputPath = path.join(exportDirectory, `${profile.id}.mp4`);
    const subtitlePath = resolveVisualProjectPath(process.cwd(), subtitleArtifact.outputPath);

    if (profile.lyricOnly) {
      await exportLyricOnlyProfile({ audioPath, outputPath, profile, subtitlePath });
    } else {
      await exportVisualProfile({
        assembledVideoPath,
        audioPath,
        outputPath,
        profile,
        subtitlePath,
      });
    }

    artifacts.push({
      profileId: profile.id,
      relativePath: relativeProjectPath(outputPath),
    });
  }

  return artifacts;
}