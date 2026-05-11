import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  readVisualProjectManifest,
  relativeProjectPath,
  resolveVisualProjectMedia,
} from "@/modules/visual-engine/manifest";
import {
  getVisualProjectAssetFolders,
  resolveVisualProjectPath,
} from "@/modules/visual-engine/paths";
import type { VisualEngineLyricsArtifacts, VisualEngineLyricsWord } from "@/modules/visual-engine/types";
import {
  alignLyricsToSource,
  getAlignedLyricsFileLabel,
  getAlignedLyricsFileName,
  type LyricsAlignmentReport,
} from "@/modules/visual-engine/lyrics/align";
import { generateAss } from "@/modules/visual-engine/lyrics/generateAss";
import { groupLyricsLines } from "@/modules/visual-engine/lyrics/groupLines";
import { generateSrt } from "@/modules/visual-engine/lyrics/generateSrt";

const DEFAULT_WHISPER_MODEL = process.env.VISUAL_ENGINE_WHISPER_MODEL ?? "whisper-1";
const DEFAULT_WHISPER_URL = process.env.VISUAL_ENGINE_WHISPER_URL ?? "";
const DEFAULT_WHISPER_API_KEY = process.env.VISUAL_ENGINE_WHISPER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const DEFAULT_WHISPER_LANGUAGE = process.env.VISUAL_ENGINE_WHISPER_LANGUAGE ?? "";

export type LyricsPipelineError = Error & {
  details?: string[];
  statusCode?: number;
};

function createLyricsPipelineError(
  message: string,
  statusCode = 400,
  details?: string[],
): LyricsPipelineError {
  const error = new Error(message) as LyricsPipelineError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

export function isWhisperConfigured(): boolean {
  return Boolean(DEFAULT_WHISPER_URL);
}

function toTimedWord(candidate: unknown): VisualEngineLyricsWord | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const payload = candidate as Record<string, unknown>;
  const start = typeof payload.start === "number"
    ? payload.start
    : Number.parseFloat(String(payload.start ?? ""));
  const end = typeof payload.end === "number"
    ? payload.end
    : Number.parseFloat(String(payload.end ?? ""));
  const textCandidate = typeof payload.word === "string"
    ? payload.word
    : typeof payload.text === "string"
      ? payload.text
      : "";
  const text = textCandidate.trim();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || text.length === 0) {
    return null;
  }

  return {
    end,
    start,
    text,
  };
}

function wordsFromUnknown(value: unknown): VisualEngineLyricsWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(toTimedWord)
    .filter((word): word is VisualEngineLyricsWord => word !== null)
    .sort((left, right) => left.start - right.start);
}

function extractTimedWords(payload: unknown): VisualEngineLyricsWord[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as Record<string, unknown>;
  const topLevelWords = wordsFromUnknown(data.words);

  if (topLevelWords.length > 0) {
    return topLevelWords;
  }

  if (Array.isArray(data.segments)) {
    const segmentWords = data.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") {
        return [];
      }

      return wordsFromUnknown((segment as Record<string, unknown>).words);
    });

    if (segmentWords.length > 0) {
      return segmentWords;
    }
  }

  return [];
}

async function transcribeAudioWithWhisper(audioPath: string): Promise<VisualEngineLyricsWord[]> {
  if (!DEFAULT_WHISPER_URL) {
    throw createLyricsPipelineError(
      "Whisper transcription is not configured.",
      503,
      ["Set VISUAL_ENGINE_WHISPER_URL to enable automated lyrics timing."],
    );
  }

  const audioBuffer = await readFile(audioPath);
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), path.basename(audioPath));
  formData.append("model", DEFAULT_WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  if (DEFAULT_WHISPER_LANGUAGE) {
    formData.append("language", DEFAULT_WHISPER_LANGUAGE);
  }

  const headers = new Headers();

  if (DEFAULT_WHISPER_API_KEY) {
    headers.set("Authorization", `Bearer ${DEFAULT_WHISPER_API_KEY}`);
  }

  const response = await fetch(DEFAULT_WHISPER_URL, {
    body: formData,
    headers,
    method: "POST",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw createLyricsPipelineError(
      "Whisper transcription failed.",
      response.status,
      [responseText || `Provider returned HTTP ${response.status}.`],
    );
  }

  const payload = await response.json();
  const words = extractTimedWords(payload);

  if (words.length === 0) {
    throw createLyricsPipelineError(
      "Whisper transcription did not return word timestamps.",
      502,
      ["Ensure the provider supports verbose_json responses with word timestamps."],
    );
  }

  return words;
}

async function readLyricsSourceText(projectId: string, lyricsFile: string | null): Promise<string | null> {
  if (!lyricsFile) {
    return null;
  }

  try {
    return await readFile(resolveVisualProjectPath(projectId, lyricsFile), "utf8");
  } catch {
    return null;
  }
}

type GeneratedLyricsBundle = {
  alignedJsonPath: string | null;
  alignmentReport: LyricsAlignmentReport | null;
  artifacts: VisualEngineLyricsArtifacts;
  usedAlignedTimestamps: boolean;
};

async function generateLyricsBundle(projectId: string): Promise<GeneratedLyricsBundle> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw createLyricsPipelineError("Visual Engine project was not found.", 404);
  }

  const resolvedMedia = await resolveVisualProjectMedia(projectId, project);

  if (!resolvedMedia.audioFile) {
    throw createLyricsPipelineError("Project audio is required before generating lyrics timing.", 400, [
      "Missing audio file",
    ]);
  }

  const folders = getVisualProjectAssetFolders(projectId);
  await mkdir(folders.lyrics, { recursive: true });

  const audioPath = resolveVisualProjectPath(projectId, resolvedMedia.audioFile);
  const sourceLyricsText = await readLyricsSourceText(projectId, resolvedMedia.lyricsFile);
  const words = await transcribeAudioWithWhisper(audioPath);
  const fallbackLines = groupLyricsLines(words, { sourceLyricsText });
  const alignedJsonPath = path.join(folders.lyrics, getAlignedLyricsFileName());
  const jsonPath = path.join(folders.lyrics, "lyrics.json");
  const srtPath = path.join(folders.lyrics, "lyrics.srt");
  const assPath = path.join(folders.lyrics, "lyrics.ass");
  let alignmentReport: LyricsAlignmentReport | null = null;
  let alignedLines = fallbackLines;
  let relativeAlignedJsonPath: string | null = null;
  let usedAlignedTimestamps = false;

  if (sourceLyricsText) {
    const alignment = alignLyricsToSource({
      audioPath,
      sourceLyricsText,
      transcriptWords: words,
    });
    const hasAlignedLines = alignment.alignedLines.length > 0;
    alignmentReport = alignment.report;

    await writeFile(alignedJsonPath, `${JSON.stringify({
      alignedAt: new Date().toISOString(),
      audioFile: getAlignedLyricsFileLabel(audioPath),
      lines: alignment.alignedLines,
      projectId,
      report: alignment.report,
      sourceLyricsFile: resolvedMedia.lyricsFile,
      transcriptText: alignment.transcriptText,
      transcriptWords: words,
    }, null, 2)}\n`, "utf8");

    relativeAlignedJsonPath = relativeProjectPath(alignedJsonPath);

    if (hasAlignedLines && alignment.report.fallback.shouldPreferAlignedTimestamps) {
      alignedLines = alignment.alignedLines;
      usedAlignedTimestamps = true;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    lines: fallbackLines,
    model: DEFAULT_WHISPER_MODEL,
    projectId,
    sourceLyricsFile: resolvedMedia.lyricsFile,
    words,
  };

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(srtPath, generateSrt({ alignedLines: usedAlignedTimestamps ? alignedLines : [], fallbackLines }), "utf8");
  await writeFile(assPath, generateAss({ alignedLines: usedAlignedTimestamps ? alignedLines : [], fallbackLines }), "utf8");

  return {
    alignedJsonPath: relativeAlignedJsonPath,
    alignmentReport,
    artifacts: {
      assPath: relativeProjectPath(assPath),
      jsonPath: relativeProjectPath(jsonPath),
      lineCount: alignedLines.length,
      lines: alignedLines,
      projectId,
      srtPath: relativeProjectPath(srtPath),
      wordCount: words.length,
      words,
    },
    usedAlignedTimestamps,
  };
}

export async function generateLyricsArtifacts(projectId: string): Promise<VisualEngineLyricsArtifacts> {
  const bundle = await generateLyricsBundle(projectId);
  return bundle.artifacts;
}

export async function alignLyricsArtifacts(projectId: string): Promise<{
  alignedJsonPath: string | null;
  alignmentReport: LyricsAlignmentReport | null;
  artifacts: VisualEngineLyricsArtifacts;
  usedAlignedTimestamps: boolean;
}> {
  return generateLyricsBundle(projectId);
}