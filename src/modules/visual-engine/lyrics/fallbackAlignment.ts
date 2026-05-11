import type { VisualEngineLyricsLine, VisualEngineLyricsWord } from "@/modules/visual-engine/types";

const LOW_ANCHOR_DENSITY_THRESHOLD = 0.18;
const LOW_CONFIDENCE_THRESHOLD = 0.45;
const SPARSE_TRANSCRIPT_COVERAGE_THRESHOLD = 0.45;
const MIN_LINE_DURATION_SECONDS = 1.2;

export type FallbackAlignmentMode = "none" | "smart_duration_interpolation" | "forced_alignment_adapter";

export type FallbackAlignmentTrigger =
  | "low_anchor_density"
  | "low_confidence_alignment"
  | "sparse_transcript_coverage";

export type FallbackAlignmentMetrics = {
  anchorDensity: number;
  matchedSourceCoverage: number;
  shouldActivateFallback: boolean;
  shouldPreferAlignedTimestamps: boolean;
  transcriptCoverage: number;
  triggers: FallbackAlignmentTrigger[];
};

export type ForcedAlignmentBackendAdapter = {
  description?: string;
  id: string;
};

export type FallbackLineInput = {
  index: number;
  matchedWords: VisualEngineLyricsWord[];
  text: string;
  tokens: string[];
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + ((end - start) * amount);
}

function createLineWords(tokens: string[], start: number, end: number): VisualEngineLyricsWord[] {
  if (tokens.length === 0) {
    return [];
  }

  const lineDuration = Math.max(MIN_LINE_DURATION_SECONDS, end - start);
  const step = lineDuration / tokens.length;

  return tokens.map((token, index) => {
    const wordStart = start + (index * step);
    const wordEnd = index === tokens.length - 1
      ? end
      : start + ((index + 1) * step);

    return {
      end: wordEnd,
      start: wordStart,
      text: token,
    };
  });
}

export function evaluateFallbackAlignment({
  confidenceScore,
  matchedWordCount,
  sourceWordCount,
  transcriptWordCount,
}: {
  confidenceScore: number;
  matchedWordCount: number;
  sourceWordCount: number;
  transcriptWordCount: number;
}): FallbackAlignmentMetrics {
  const anchorDensity = sourceWordCount > 0 ? matchedWordCount / sourceWordCount : 0;
  const matchedSourceCoverage = anchorDensity;
  const transcriptCoverage = sourceWordCount > 0 ? transcriptWordCount / sourceWordCount : 0;
  const triggers: FallbackAlignmentTrigger[] = [];

  if (anchorDensity < LOW_ANCHOR_DENSITY_THRESHOLD) {
    triggers.push("low_anchor_density");
  }

  if (confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
    triggers.push("low_confidence_alignment");
  }

  if (transcriptCoverage < SPARSE_TRANSCRIPT_COVERAGE_THRESHOLD) {
    triggers.push("sparse_transcript_coverage");
  }

  return {
    anchorDensity: Number(anchorDensity.toFixed(3)),
    matchedSourceCoverage: Number(matchedSourceCoverage.toFixed(3)),
    shouldActivateFallback: triggers.length > 0,
    shouldPreferAlignedTimestamps: triggers.length > 0 && transcriptWordCount > 0 && sourceWordCount > 0,
    transcriptCoverage: Number(transcriptCoverage.toFixed(3)),
    triggers,
  };
}

export function buildSmartDurationFallbackLines({
  sourceLines,
  transcriptWords,
}: {
  sourceLines: FallbackLineInput[];
  transcriptWords: VisualEngineLyricsWord[];
}): VisualEngineLyricsLine[] {
  if (sourceLines.length === 0) {
    return [];
  }

  const transcriptStart = Math.max(0, transcriptWords[0]?.start ?? 0);
  const transcriptEnd = transcriptWords[transcriptWords.length - 1]?.end
    ?? transcriptStart + (sourceLines.reduce((sum, line) => sum + line.tokens.length, 0) * 0.55);
  const totalSpan = Math.max(MIN_LINE_DURATION_SECONDS * sourceLines.length, transcriptEnd - transcriptStart);
  const weights = sourceLines.map((line) => line.tokens.length + 0.6);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const baseWindows = sourceLines.map((line, index) => {
    const weightBefore = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
    const weightCurrent = weights[index];
    const baseStart = transcriptStart + (totalSpan * (weightBefore / totalWeight));
    const baseEnd = transcriptStart + (totalSpan * ((weightBefore + weightCurrent) / totalWeight));
    const matchedWords = line.matchedWords;

    if (matchedWords.length === 0) {
      return {
        end: baseEnd,
        start: baseStart,
      };
    }

    const anchorStart = matchedWords[0].start;
    const anchorEnd = matchedWords[matchedWords.length - 1].end;
    const anchorStrength = clamp(0.2 + ((matchedWords.length / Math.max(1, line.tokens.length)) * 0.45), 0.2, 0.7);

    return {
      end: lerp(baseEnd, Math.max(anchorEnd + 0.18, anchorStart + MIN_LINE_DURATION_SECONDS), anchorStrength),
      start: lerp(baseStart, Math.max(transcriptStart, anchorStart - 0.18), anchorStrength),
    };
  });

  const normalizedWindows: Array<{ end: number; start: number }> = [];

  for (const [index, window] of baseWindows.entries()) {
    const remainingLines = sourceLines.length - index - 1;
    const previousWindowEnd = index === 0 ? transcriptStart : normalizedWindows[index - 1].end;
    const start = Math.max(previousWindowEnd, window.start);
    const latestEnd = index === sourceLines.length - 1
      ? transcriptStart + totalSpan
      : (transcriptStart + totalSpan) - (remainingLines * MIN_LINE_DURATION_SECONDS);
    const end = index === sourceLines.length - 1
      ? transcriptStart + totalSpan
      : clamp(Math.max(start + MIN_LINE_DURATION_SECONDS, window.end), start + MIN_LINE_DURATION_SECONDS, latestEnd);

    normalizedWindows.push({ end, start });
  }

  return sourceLines.map((line, index) => {
    const window = normalizedWindows[index];
    const words = createLineWords(line.tokens, window.start, window.end);

    return {
      end: window.end,
      index: line.index,
      start: window.start,
      text: line.text,
      words,
    };
  });
}