import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { syncScenesToAudioDuration } from "@/modules/final-assembly/audioSyncEngine";
import { exportAssemblyProfiles, renderMasterAssembly } from "@/modules/final-assembly/exportEngine";
import { getFinalAssemblyRenderProfiles } from "@/modules/final-assembly/renderProfiles";
import { recoverRetryState } from "@/modules/final-assembly/retryRecovery";
import { assembleSceneTimeline } from "@/modules/final-assembly/sceneAssembler";
import { buildSubtitleCues, writeSubtitleArtifacts } from "@/modules/final-assembly/subtitleEngine";
import type { FinalAssemblyResult, FinalAssemblyStage, FinalAssemblyState } from "@/modules/final-assembly/types";
import { readSceneExecutionState } from "@/modules/scene-execution";
import { readTimelinePlan } from "@/modules/timeline-director";
import { readProviderExecutionPlan } from "@/modules/video-generation/governance";
import { readSceneVideoState } from "@/modules/video-generation/sceneVideoManifest";
import { readVisualProjectManifest, relativeProjectPath, resolveVisualProjectMedia } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders, resolveVisualProjectPath } from "@/modules/visual-engine/paths";
import { packageProject } from "@/modules/visual-engine/export/packageProject";
import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";

const FINAL_ASSEMBLY_FILE = "finalAssembly.json";
const PROVIDER_EXECUTION_PLAN_FILE = "providerExecutionPlan.json";
const TIMELINE_PLAN_FILE = "timelinePlan.json";
const LYRICS_FILE = "lyrics.json";
const SCENE_EXECUTION_MANIFEST_FILE = "sceneAssets.json";
const DEFAULT_FFPROBE_PATH = process.env.FFPROBE_PATH ?? "ffprobe";

type FinalAssemblyError = Error & {
  details?: string[];
  statusCode?: number;
};

function createFinalAssemblyError(message: string, statusCode = 400, details?: string[]): FinalAssemblyError {
  const error = new Error(message) as FinalAssemblyError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getFinalAssemblyPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).exports, FINAL_ASSEMBLY_FILE);
}

function getExportsDirectory(projectId: string): string {
  return getVisualProjectAssetFolders(projectId).exports;
}

function getWorkingDirectory(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).renders, "final-assembly");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeState(state: Omit<FinalAssemblyState, "updatedAt"> & { updatedAt?: string }): FinalAssemblyState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}

async function writeFinalAssemblyState(state: FinalAssemblyState): Promise<FinalAssemblyState> {
  const normalized = normalizeState(state);
  const targetPath = getFinalAssemblyPath(state.projectId);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function readFinalAssemblyState(projectId: string): Promise<FinalAssemblyState | null> {
  try {
    const source = await readFile(getFinalAssemblyPath(projectId), "utf8");
    const payload = JSON.parse(source) as FinalAssemblyState;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.scenes) || !Array.isArray(payload.subtitleCues)) {
      return null;
    }

    return normalizeState(payload);
  } catch {
    return null;
  }
}

async function readLyricsLines(projectId: string): Promise<{ path: string; lines: VisualEngineLyricsLine[] }> {
  const lyricsPath = path.join(getVisualProjectAssetFolders(projectId).lyrics, LYRICS_FILE);

  if (!await pathExists(lyricsPath)) {
    throw createFinalAssemblyError("Lyrics metadata not found. Generate lyrics before final assembly.", 404, ["lyrics.json missing"]);
  }

  const payload = JSON.parse(await readFile(lyricsPath, "utf8")) as { lines?: VisualEngineLyricsLine[] };

  if (!Array.isArray(payload.lines)) {
    throw createFinalAssemblyError("Lyrics metadata could not be read for final assembly.", 500);
  }

  return { lines: payload.lines, path: lyricsPath };
}

async function getAudioDuration(audioPath: string): Promise<number> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const result = await execFileAsync(
      DEFAULT_FFPROBE_PATH,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath],
      { windowsHide: true },
    );
    const duration = Number.parseFloat((result.stdout ?? "").trim());

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Invalid audio duration");
    }

    return duration;
  } catch (error) {
    const probeError = error as NodeJS.ErrnoException & { stderr?: string };

    if (probeError.code === "ENOENT") {
      throw createFinalAssemblyError("FFprobe is not available. Set FFPROBE_PATH before final assembly.", 503);
    }

    throw createFinalAssemblyError(
      `Could not inspect master audio duration: ${probeError.stderr?.trim() || probeError.message || "ffprobe failed"}`,
      500,
    );
  }
}

async function buildPlannedState(projectId: string): Promise<FinalAssemblyState> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw createFinalAssemblyError("Visual Engine project was not found.", 404);
  }

  const resolvedMedia = await resolveVisualProjectMedia(projectId, project);

  if (!resolvedMedia.audioFile) {
    throw createFinalAssemblyError("Master audio track is missing. Upload audio before final assembly.", 400);
  }

  const timelinePlan = await readTimelinePlan(projectId);
  const providerExecutionPlan = await readProviderExecutionPlan(projectId);
  const sceneExecutionState = await readSceneExecutionState(projectId);
  const sceneVideoState = await readSceneVideoState(projectId);
  const lyrics = await readLyricsLines(projectId);

  if (!timelinePlan) {
    throw createFinalAssemblyError("Timeline plan not found. Generate a timeline plan before final assembly.", 404, ["timelinePlan.json missing"]);
  }

  if (!providerExecutionPlan) {
    throw createFinalAssemblyError("Provider execution plan not found. Generate provider governance output before final assembly.", 404, ["providerExecutionPlan.json missing"]);
  }

  if (!sceneExecutionState) {
    throw createFinalAssemblyError("Scene execution manifest not found. Generate approved scenes before final assembly.", 404, ["sceneAssets.json missing"]);
  }

  if (!sceneVideoState) {
    throw createFinalAssemblyError("Scene video manifest not found. Generate scene videos before final assembly.", 404, ["sceneVideos.json missing"]);
  }

  const assembledTimeline = await assembleSceneTimeline({
    projectId,
    providerExecutionPlan,
    sceneExecutionState,
    sceneVideoState,
    timelinePlan,
  });
  const audioPath = resolveVisualProjectPath(projectId, resolvedMedia.audioFile);
  const audioDuration = await getAudioDuration(audioPath);
  const synced = syncScenesToAudioDuration(assembledTimeline.scenes, audioDuration);
  const subtitleCues = buildSubtitleCues(lyrics.lines);
  const createdAt = new Date().toISOString();

  return normalizeState({
    artifacts: {
      assembledVideoPath: undefined,
      exportArtifacts: [],
      subtitleArtifacts: [],
    },
    createdAt,
    currentStage: "scene-assembly",
    projectId,
    scenes: synced.scenes,
    sourceManifests: {
      audio: resolvedMedia.audioFile,
      finalAssembly: relativeProjectPath(getFinalAssemblyPath(projectId)),
      lyrics: relativeProjectPath(lyrics.path),
      providerExecutionPlan: relativeProjectPath(path.join(getVisualProjectAssetFolders(projectId).lyrics, PROVIDER_EXECUTION_PLAN_FILE)),
      sceneExecutionManifest: relativeProjectPath(path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_EXECUTION_MANIFEST_FILE)),
      timelinePlan: relativeProjectPath(path.join(getVisualProjectAssetFolders(projectId).lyrics, TIMELINE_PLAN_FILE)),
    },
    status: "idle",
    subtitleCues,
    warnings: [...assembledTimeline.warnings, ...synced.warnings],
  });
}

export async function planFinalAssembly(projectId: string): Promise<FinalAssemblyState> {
  return writeFinalAssemblyState(await buildPlannedState(projectId));
}

async function updateStateStage(
  state: FinalAssemblyState,
  currentStage: FinalAssemblyStage,
  status: FinalAssemblyState["status"],
  patch?: Partial<FinalAssemblyState>,
) {
  return writeFinalAssemblyState({
    ...state,
    ...patch,
    currentStage,
    status,
  });
}

export async function assembleFinalVideo(projectId: string): Promise<FinalAssemblyResult> {
  let state = await readFinalAssemblyState(projectId);

  if (!state) {
    state = await planFinalAssembly(projectId);
  } else if (state.status === "failed") {
    state = await writeFinalAssemblyState(await recoverRetryState(state));
  }

  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw createFinalAssemblyError("Visual Engine project was not found.", 404);
  }

  const resolvedMedia = await resolveVisualProjectMedia(projectId, project);

  if (!resolvedMedia.audioFile) {
    throw createFinalAssemblyError("Master audio track is missing. Upload audio before final assembly.", 400);
  }

  try {
    const subtitleDirectory = path.join(getExportsDirectory(projectId), "subtitles");
    state = await updateStateStage(state, "subtitle-prep", "assembling");
    const subtitleArtifacts = state.artifacts.subtitleArtifacts.length > 0
      ? state.artifacts.subtitleArtifacts
      : await writeSubtitleArtifacts(state.subtitleCues, subtitleDirectory, ["karaoke", "cinematic", "lyric-highlight"]);
    state = await writeFinalAssemblyState({
      ...state,
      artifacts: {
        ...state.artifacts,
        subtitleArtifacts,
      },
    });

    state = await updateStateStage(state, "render-master", "assembling");
    const workingDirectory = getWorkingDirectory(projectId);
    const assembledVideoAbsolutePath = state.artifacts.assembledVideoPath
      ? resolveVisualProjectPath(projectId, state.artifacts.assembledVideoPath)
      : await renderMasterAssembly({ projectId, scenes: state.scenes, workingDirectory });
    state = await writeFinalAssemblyState({
      ...state,
      artifacts: {
        ...state.artifacts,
        assembledVideoPath: relativeProjectPath(assembledVideoAbsolutePath),
      },
    });

    state = await updateStateStage(state, "export-profiles", "rendering");
    const audioPath = resolveVisualProjectPath(projectId, resolvedMedia.audioFile);
    const exportArtifacts = await exportAssemblyProfiles({
      assembledVideoPath: assembledVideoAbsolutePath,
      audioPath,
      exportDirectory: getExportsDirectory(projectId),
      profiles: getFinalAssemblyRenderProfiles(),
      subtitleArtifacts: state.artifacts.subtitleArtifacts,
    });

    const primaryExport = exportArtifacts.find((artifact) => artifact.profileId === "youtube-16-9") ?? exportArtifacts[0];

    if (!primaryExport) {
      throw createFinalAssemblyError("No final assembly exports were produced.", 500);
    }

    const audioDuration = await getAudioDuration(audioPath);
    const packageResult = await packageProject(projectId, resolveVisualProjectPath(projectId, primaryExport.relativePath), {
      duration: `${audioDuration.toFixed(2)}s`,
      usedAudio: resolvedMedia.audioFile,
      usedImage: state.scenes[0]?.sourcePath ?? resolvedMedia.audioFile,
    });

    state = await writeFinalAssemblyState({
      ...state,
      artifacts: {
        ...state.artifacts,
        exportArtifacts,
      },
      currentStage: "export-profiles",
      status: "completed",
    });

    return {
      duration: `${audioDuration.toFixed(2)}s`,
      exportPaths: Object.fromEntries(exportArtifacts.map((artifact) => [artifact.profileId, artifact.relativePath])) as FinalAssemblyResult["exportPaths"],
      outputPath: primaryExport.relativePath,
      packagePath: packageResult.packagePath,
      primaryExportProfile: primaryExport.profileId,
      projectId,
      renderPath: primaryExport.relativePath,
      status: "completed",
      success: true,
      usedAudio: resolvedMedia.audioFile,
      usedImage: state.scenes[0]?.sourcePath ?? resolvedMedia.audioFile,
    };
  } catch (error) {
    const assemblyError = error as FinalAssemblyError;
    await writeFinalAssemblyState({
      ...state,
      error: assemblyError.message || "Final assembly failed.",
      status: "failed",
    });
    throw createFinalAssemblyError(assemblyError.message || "Final assembly failed.", assemblyError.statusCode ?? 500, assemblyError.details);
  }
}