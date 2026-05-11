import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { SupportedComfyWorkflowType } from "@/modules/comfy/workflows";
import { generateLyricsArtifacts } from "@/modules/visual-engine/lyrics/transcribe";
import { readVisualProjectManifest, relativeProjectPath, resolveVisualProjectMedia } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders, resolveVisualProjectPath } from "@/modules/visual-engine/paths";
import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";

const execFileAsync = promisify(execFile);
const DEFAULT_FFPROBE_PATH = process.env.FFPROBE_PATH ?? "ffprobe";
const ALIGNED_LYRICS_FILE = "lyrics-aligned.json";
const FALLBACK_LYRICS_FILE = "lyrics.json";
const SCENE_PLAN_FILE = "scenePlan.json";
const SILENCE_GAP_SECONDS = 2.8;
const TRANSITION_GAP_SECONDS = 1.25;

export type ScenePlanPriority = "high" | "low";
export type SceneGenerationType = "intro" | "lyric" | "chorus" | "peak" | "transition" | "outro";

export type ScenePlanScene = {
  cameraDirection: string;
  emotionalTone: string;
  endTime: number;
  generationType: SceneGenerationType;
  id: string;
  lyricSegment: string;
  priority: ScenePlanPriority;
  startTime: number;
  visualDescription: string;
  workflowType: SupportedComfyWorkflowType;
};

export type ScenePlan = {
  scenes: ScenePlanScene[];
};

type ScenePlannerOptions = {
  creativeDirection?: string;
  projectId: string;
  regenerateSceneId?: string;
  songDuration?: number;
  stylePreset?: string;
};

type TimestampSource = {
  lines: VisualEngineLyricsLine[];
  source: "aligned" | "generated";
};

type ScenePlannerError = Error & {
  details?: string[];
  statusCode?: number;
};

type SceneBuildContext = {
  creativeDirection?: string;
  duration: number;
  line: VisualEngineLyricsLine;
  lineIndex: number;
  occurrenceCount: number;
  regenerateSceneId?: string;
  repeatedSegments: Set<string>;
  sceneId: string;
  stylePreset?: string;
  totalLines: number;
};

type TimingPayload = {
  lines?: unknown;
};

function createScenePlannerError(message: string, statusCode = 400, details?: string[]): ScenePlannerError {
  const error = new Error(message) as ScenePlannerError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function isLyricsLine(value: unknown): value is VisualEngineLyricsLine {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.index === "number"
    && typeof candidate.start === "number"
    && typeof candidate.end === "number"
    && typeof candidate.text === "string"
    && Array.isArray(candidate.words);
}

function parseTimingPayload(source: string): VisualEngineLyricsLine[] {
  const payload = JSON.parse(source) as TimingPayload;

  if (!Array.isArray(payload.lines)) {
    return [];
  }

  return payload.lines.filter(isLyricsLine).sort((left, right) => left.start - right.start);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getAudioDuration(audioPath: string): Promise<number | null> {
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

    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

function formatLabel(value: string): string {
  return value.replace(/[-_]+/g, " ").trim();
}

function normalizeLyricSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function clampTime(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Number.parseFloat(value.toFixed(2));
}

function createSceneId(index: number): string {
  return `scene-${String(index).padStart(3, "0")}`;
}

function routeWorkflowForPriority(priority: ScenePlanPriority): SupportedComfyWorkflowType {
  return priority === "high" ? "flux-dev-cinematic" : "flux-fast-concept";
}

function detectEmotionalTone(line: VisualEngineLyricsLine, occurrenceCount: number): string {
  const text = line.text.trim();
  const lowerText = text.toLowerCase();
  const emotionalKeywords = [
    "fire",
    "burn",
    "heart",
    "fall",
    "rise",
    "night",
    "dream",
    "alive",
    "run",
    "hold",
    "love",
    "lost",
    "light",
  ];
  const keywordHits = emotionalKeywords.filter((keyword) => lowerText.includes(keyword)).length;
  const uppercaseRatio = text.length > 0
    ? text.split("").filter((character) => /[A-Z]/.test(character)).length / text.length
    : 0;

  if (occurrenceCount > 1) {
    return "anthemic";
  }

  if (text.includes("!") || uppercaseRatio > 0.18 || keywordHits >= 3) {
    return "intense";
  }

  if (keywordHits >= 2) {
    return "emotive";
  }

  if (lowerText.includes("fade") || lowerText.includes("echo") || lowerText.includes("alone")) {
    return "reflective";
  }

  return "steady";
}

function getCameraDirection(input: {
  generationType: SceneGenerationType;
  isRegenerated: boolean;
  priority: ScenePlanPriority;
}): string {
  const variants: Record<SceneGenerationType, [string, string]> = {
    chorus: [
      "Sweeping push-in with layered parallax and strong foreground motion.",
      "Wide hero frame with a slow orbit and controlled rack focus.",
    ],
    intro: [
      "Slow reveal from darkness with a gentle dolly forward.",
      "Atmospheric wide establishing shot with soft drifting movement.",
    ],
    lyric: input.priority === "high"
      ? [
          "Close cinematic framing with a restrained handheld drift.",
          "Medium tracking shot with expressive focus pulls.",
        ]
      : [
          "Locked composition with subtle lateral motion for readability.",
          "Measured medium-wide frame with a calm pan.",
        ],
    outro: [
      "Lingering pull-back into negative space for a final release.",
      "Slow receding frame with fading atmosphere and soft depth.",
    ],
    peak: [
      "Aggressive push-in with dramatic lens compression and kinetic energy.",
      "Hero close-up with bold perspective and fast momentum cues.",
    ],
    transition: [
      "Minimal transitional frame with slow environmental drift.",
      "Bridge shot with abstract motion and space for a clean cut.",
    ],
  };

  const [primary, alternate] = variants[input.generationType];
  return input.isRegenerated ? alternate : primary;
}

function getVisualDescription(context: SceneBuildContext & {
  generationType: SceneGenerationType;
  tone: string;
}): string {
  const lyricPrompt = context.line.text.trim() || "instrumental break";
  const projectMoment = context.generationType === "chorus"
    ? "returning refrain moment"
    : context.generationType === "peak"
    ? "emotional high point"
    : context.generationType;
  const style = context.stylePreset ? ` Style preset: ${formatLabel(context.stylePreset)}.` : "";
  const direction = context.creativeDirection ? ` Creative direction: ${context.creativeDirection.trim()}.` : "";
  const variation = context.sceneId === context.regenerateSceneId ? " Alternate framing variation." : "";

  return `Design a ${context.tone} ${projectMoment} inspired by the lyric \"${lyricPrompt}\" with strong visual clarity and image-generation-ready detail.${style}${direction}${variation}`.trim();
}

function createTransitionScene(input: {
  duration: number;
  endTime: number;
  index: number;
  kind: "intro" | "outro" | "transition";
  startTime: number;
}): ScenePlanScene {
  const priority: ScenePlanPriority = input.kind === "transition" ? "low" : "high";
  const emotionalTone = input.kind === "transition" ? "breathing room" : input.kind === "intro" ? "anticipatory" : "resolved";
  const lyricSegment = input.kind === "transition" ? "" : input.kind === "intro" ? "(instrumental intro)" : "(instrumental outro)";
  const visualDescription = input.kind === "transition"
    ? "Create a transition frame that bridges lyrical scenes with atmospheric space and visual continuity."
    : input.kind === "intro"
    ? "Create an opening image that establishes the world before the first lyric lands."
    : "Create a closing image that lets the song exhale after the last lyric fades.";

  return {
    cameraDirection: getCameraDirection({ generationType: input.kind, isRegenerated: false, priority }),
    emotionalTone,
    endTime: clampTime(Math.min(input.endTime, input.duration), input.endTime),
    generationType: input.kind,
    id: createSceneId(input.index),
    lyricSegment,
    priority,
    startTime: clampTime(input.startTime, 0),
    visualDescription,
    workflowType: routeWorkflowForPriority(priority),
  };
}

export function buildScenePlan(input: {
  creativeDirection?: string;
  duration: number;
  lines: VisualEngineLyricsLine[];
  regenerateSceneId?: string;
  stylePreset?: string;
}): ScenePlan {
  const scenes: ScenePlanScene[] = [];
  const duration = Math.max(input.duration, input.lines.at(-1)?.end ?? 0);
  const repeatedCounts = new Map<string, number>();

  for (const line of input.lines) {
    const normalized = normalizeLyricSegment(line.text);

    if (!normalized) {
      continue;
    }

    repeatedCounts.set(normalized, (repeatedCounts.get(normalized) ?? 0) + 1);
  }

  const repeatedSegments = new Set(
    Array.from(repeatedCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([segment]) => segment),
  );
  let sceneIndex = 1;

  if (input.lines.length === 0) {
    return { scenes: [] };
  }

  const firstLine = input.lines[0];

  if (firstLine.start >= SILENCE_GAP_SECONDS) {
    scenes.push(createTransitionScene({
      duration,
      endTime: firstLine.start,
      index: sceneIndex,
      kind: "intro",
      startTime: 0,
    }));
    sceneIndex += 1;
  }

  input.lines.forEach((line, lineIndex) => {
    const normalized = normalizeLyricSegment(line.text);

    if (!normalized) {
      return;
    }

    if (lineIndex > 0) {
      const previousLine = input.lines[lineIndex - 1];
      const gap = line.start - previousLine.end;

      if (gap >= SILENCE_GAP_SECONDS || gap >= TRANSITION_GAP_SECONDS) {
        scenes.push(createTransitionScene({
          duration,
          endTime: line.start,
          index: sceneIndex,
          kind: "transition",
          startTime: previousLine.end,
        }));
        sceneIndex += 1;
      }
    }

    const occurrenceCount = repeatedCounts.get(normalized) ?? 1;
    const tone = detectEmotionalTone(line, occurrenceCount);
    const nearStart = line.start <= Math.max(6, duration * 0.08);
    const nearEnd = line.end >= Math.max(duration - 8, duration * 0.88);
    const isChorus = repeatedSegments.has(normalized);
    const isPeak = tone === "intense" || tone === "anthemic";
    const generationType: SceneGenerationType = isChorus ? "chorus" : isPeak ? "peak" : nearStart ? "intro" : nearEnd ? "outro" : "lyric";
    const priority: ScenePlanPriority = generationType === "peak" || generationType === "chorus" || nearEnd ? "high" : "low";
    const sceneId = createSceneId(sceneIndex);
    const isRegenerated = input.regenerateSceneId === sceneId;

    scenes.push({
      cameraDirection: getCameraDirection({ generationType, isRegenerated, priority }),
      emotionalTone: tone,
      endTime: clampTime(Math.min(line.end, duration), line.end),
      generationType,
      id: sceneId,
      lyricSegment: line.text.trim(),
      priority,
      startTime: clampTime(line.start, 0),
      visualDescription: getVisualDescription({
        creativeDirection: input.creativeDirection,
        duration,
        generationType,
        line,
        lineIndex,
        occurrenceCount,
        regenerateSceneId: input.regenerateSceneId,
        repeatedSegments,
        sceneId,
        stylePreset: input.stylePreset,
        tone,
        totalLines: input.lines.length,
      }),
      workflowType: routeWorkflowForPriority(priority),
    });
    sceneIndex += 1;
  });

  const lastLine = input.lines.at(-1);

  if (lastLine && duration - lastLine.end >= SILENCE_GAP_SECONDS) {
    scenes.push(createTransitionScene({
      duration,
      endTime: duration,
      index: sceneIndex,
      kind: "outro",
      startTime: lastLine.end,
    }));
  }

  return { scenes };
}

export function getScenePlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_PLAN_FILE);
}

export async function readScenePlan(projectId: string): Promise<ScenePlan | null> {
  try {
    const source = await readFile(getScenePlanPath(projectId), "utf8");
    const payload = JSON.parse(source) as { scenes?: unknown };

    if (!payload || !Array.isArray(payload.scenes)) {
      return null;
    }

    return {
      scenes: payload.scenes.filter((scene): scene is ScenePlanScene => {
        if (!scene || typeof scene !== "object") {
          return false;
        }

        const candidate = scene as Record<string, unknown>;
        return typeof candidate.id === "string"
          && typeof candidate.startTime === "number"
          && typeof candidate.endTime === "number"
          && typeof candidate.lyricSegment === "string"
          && typeof candidate.emotionalTone === "string"
          && typeof candidate.visualDescription === "string"
          && typeof candidate.cameraDirection === "string"
          && typeof candidate.generationType === "string"
          && typeof candidate.workflowType === "string"
          && typeof candidate.priority === "string";
      }),
    };
  } catch {
    return null;
  }
}

async function loadTimestampSource(projectId: string): Promise<TimestampSource> {
  const folders = getVisualProjectAssetFolders(projectId);
  const alignedPath = path.join(folders.lyrics, ALIGNED_LYRICS_FILE);
  const fallbackPath = path.join(folders.lyrics, FALLBACK_LYRICS_FILE);

  if (await fileExists(alignedPath)) {
    const lines = parseTimingPayload(await readFile(alignedPath, "utf8"));

    if (lines.length > 0) {
      return { lines, source: "aligned" };
    }
  }

  if (await fileExists(fallbackPath)) {
    const lines = parseTimingPayload(await readFile(fallbackPath, "utf8"));

    if (lines.length > 0) {
      return { lines, source: "generated" };
    }
  }

  const artifacts = await generateLyricsArtifacts(projectId);
  return { lines: artifacts.lines, source: "generated" };
}

export async function generateScenePlanForProject(options: ScenePlannerOptions): Promise<{
  plan: ScenePlan;
  planPath: string;
  songDuration: number;
  timestampSource: TimestampSource["source"];
}> {
  const project = await readVisualProjectManifest(options.projectId);

  if (!project) {
    throw createScenePlannerError("Visual Engine project was not found.", 404);
  }

  const resolvedMedia = await resolveVisualProjectMedia(options.projectId, project);

  if (!resolvedMedia.audioFile) {
    throw createScenePlannerError("Project audio is required before generating a scene plan.", 400, ["Missing audio file"]);
  }

  const timestampSource = await loadTimestampSource(options.projectId);

  if (timestampSource.lines.length === 0) {
    throw createScenePlannerError("Lyrics timestamps are required before generating a scene plan.", 400, ["Run lyric timing generation first"]);
  }

  const audioPath = resolveVisualProjectPath(options.projectId, resolvedMedia.audioFile);
  const inferredDuration = options.songDuration
    ?? await getAudioDuration(audioPath)
    ?? timestampSource.lines.at(-1)?.end
    ?? 0;

  if (!Number.isFinite(inferredDuration) || inferredDuration <= 0) {
    throw createScenePlannerError("Song duration could not be resolved for scene planning.", 500, [audioPath]);
  }

  const plan = buildScenePlan({
    creativeDirection: options.creativeDirection,
    duration: inferredDuration,
    lines: timestampSource.lines,
    regenerateSceneId: options.regenerateSceneId,
    stylePreset: options.stylePreset,
  });
  const scenePlanPath = getScenePlanPath(options.projectId);

  await mkdir(path.dirname(scenePlanPath), { recursive: true });
  await writeFile(scenePlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return {
    plan,
    planPath: relativeProjectPath(scenePlanPath),
    songDuration: inferredDuration,
    timestampSource: timestampSource.source,
  };
}
