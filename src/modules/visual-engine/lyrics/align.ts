import path from "node:path";

import type { VisualEngineLyricsLine, VisualEngineLyricsWord } from "@/modules/visual-engine/types";

const DEFAULT_WORD_DURATION_SECONDS = 0.32;
const MIN_WORD_DURATION_SECONDS = 0.04;

type SourceToken = {
  display: string;
  index: number;
  lineIndex: number;
  normalized: string;
};

type TranscriptToken = {
  index: number;
  normalized: string;
  word: VisualEngineLyricsWord;
};

type SourceLine = {
  index: number;
  text: string;
  tokens: SourceToken[];
};

type MatchRecord = {
  similarity: number;
  sourceIndex: number;
  transcriptIndex: number;
};

type LineTimingReport = {
  confidenceScore: number;
  index: number;
  matchedWordCount: number;
  missingWords: string[];
  text: string;
  timingDriftSeconds: number;
};

export type LyricsAlignmentReport = {
  averageTimingDriftSeconds: number;
  confidenceScore: number;
  hallucinatedWords: string[];
  lineReports: LineTimingReport[];
  matchedWordCount: number;
  maxTimingDriftSeconds: number;
  missingWords: Array<{ lineIndex: number; text: string }>;
  sourceWordCount: number;
  transcriptWordCount: number;
  unalignedTranscriptWordCount: number;
};

export type LyricsAlignmentResult = {
  alignedLines: VisualEngineLyricsLine[];
  report: LyricsAlignmentReport;
  transcriptText: string;
};

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
}

function levenshteinDistance(left: string, right: string): number {
  const columns = right.length + 1;
  const rows = left.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[rows - 1][columns - 1];
}

function tokenSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.startsWith(right) || right.startsWith(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const maxLength = Math.max(left.length, right.length);
  return Math.max(0, 1 - (levenshteinDistance(left, right) / maxLength));
}

function flattenSourceLyrics(sourceLyricsText: string): SourceLine[] {
  let tokenIndex = 0;

  return sourceLyricsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, lineIndex) => {
      const tokens = text
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
          const display = token.replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "") || token;

          return {
            display,
            index: tokenIndex++,
            lineIndex,
            normalized: normalizeToken(display),
          } satisfies SourceToken;
        })
        .filter((token) => token.normalized.length > 0);

      return {
        index: lineIndex + 1,
        text,
        tokens,
      } satisfies SourceLine;
    })
    .filter((line) => line.tokens.length > 0);
}

function normalizeTranscriptWords(words: VisualEngineLyricsWord[]): TranscriptToken[] {
  return words
    .map((word, index) => ({
      index,
      normalized: normalizeToken(word.text),
      word,
    }))
    .filter((entry) => entry.normalized.length > 0);
}

function buildAlignmentMatches(sourceTokens: SourceToken[], transcriptTokens: TranscriptToken[]): MatchRecord[] {
  const sourceCount = sourceTokens.length;
  const transcriptCount = transcriptTokens.length;
  const scores = Array.from({ length: sourceCount + 1 }, () => Array<number>(transcriptCount + 1).fill(0));
  const moves = Array.from({ length: sourceCount + 1 }, () => Array<"diag" | "left" | "up" | null>(transcriptCount + 1).fill(null));
  const deletePenalty = -1.3;
  const insertPenalty = -1.05;

  for (let sourceIndex = 1; sourceIndex <= sourceCount; sourceIndex += 1) {
    scores[sourceIndex][0] = sourceIndex * deletePenalty;
    moves[sourceIndex][0] = "up";
  }

  for (let transcriptIndex = 1; transcriptIndex <= transcriptCount; transcriptIndex += 1) {
    scores[0][transcriptIndex] = transcriptIndex * insertPenalty;
    moves[0][transcriptIndex] = "left";
  }

  for (let sourceIndex = 1; sourceIndex <= sourceCount; sourceIndex += 1) {
    for (let transcriptIndex = 1; transcriptIndex <= transcriptCount; transcriptIndex += 1) {
      const sourceToken = sourceTokens[sourceIndex - 1];
      const transcriptToken = transcriptTokens[transcriptIndex - 1];
      const similarity = tokenSimilarity(sourceToken.normalized, transcriptToken.normalized);
      const relativePositionPenalty = Math.abs((sourceIndex / sourceCount) - (transcriptIndex / transcriptCount)) * 0.75;
      const diagonalReward = similarity >= 0.72
        ? (similarity >= 0.98 ? 3.6 : 1.8 + similarity) - relativePositionPenalty
        : -2.6;
      const diagonalScore = scores[sourceIndex - 1][transcriptIndex - 1] + diagonalReward;
      const deleteScore = scores[sourceIndex - 1][transcriptIndex] + deletePenalty;
      const insertScore = scores[sourceIndex][transcriptIndex - 1] + insertPenalty;

      if (diagonalScore >= deleteScore && diagonalScore >= insertScore) {
        scores[sourceIndex][transcriptIndex] = diagonalScore;
        moves[sourceIndex][transcriptIndex] = "diag";
      } else if (deleteScore >= insertScore) {
        scores[sourceIndex][transcriptIndex] = deleteScore;
        moves[sourceIndex][transcriptIndex] = "up";
      } else {
        scores[sourceIndex][transcriptIndex] = insertScore;
        moves[sourceIndex][transcriptIndex] = "left";
      }
    }
  }

  const matches: MatchRecord[] = [];
  let sourceCursor = sourceCount;
  let transcriptCursor = transcriptCount;

  while (sourceCursor > 0 || transcriptCursor > 0) {
    const move = moves[sourceCursor][transcriptCursor];

    if (move === "diag") {
      const similarity = tokenSimilarity(
        sourceTokens[sourceCursor - 1]?.normalized ?? "",
        transcriptTokens[transcriptCursor - 1]?.normalized ?? "",
      );

      if (similarity >= 0.72) {
        matches.push({
          similarity,
          sourceIndex: sourceCursor - 1,
          transcriptIndex: transcriptCursor - 1,
        });
      }

      sourceCursor -= 1;
      transcriptCursor -= 1;
      continue;
    }

    if (move === "up") {
      sourceCursor -= 1;
      continue;
    }

    if (move === "left") {
      transcriptCursor -= 1;
      continue;
    }

    break;
  }

  return matches.reverse();
}

function median(values: number[]): number {
  if (values.length === 0) {
    return DEFAULT_WORD_DURATION_SECONDS;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function assignInterpolatedWordTimes(
  sourceTokens: SourceToken[],
  transcriptTokens: TranscriptToken[],
  matches: MatchRecord[],
): VisualEngineLyricsWord[] {
  const assigned = Array<VisualEngineLyricsWord | null>(sourceTokens.length).fill(null);

  for (const match of matches) {
    const transcriptWord = transcriptTokens[match.transcriptIndex].word;
    const sourceToken = sourceTokens[match.sourceIndex];

    assigned[match.sourceIndex] = {
      end: transcriptWord.end,
      start: transcriptWord.start,
      text: sourceToken.display,
    };
  }

  const defaultDuration = Math.max(
    MIN_WORD_DURATION_SECONDS,
    median(transcriptTokens.map((token) => token.word.end - token.word.start).filter((duration) => duration > 0)),
  );

  let cursor = 0;

  while (cursor < assigned.length) {
    if (assigned[cursor]) {
      cursor += 1;
      continue;
    }

    const runStart = cursor;

    while (cursor < assigned.length && !assigned[cursor]) {
      cursor += 1;
    }

    const runEnd = cursor - 1;
    const previousIndex = runStart - 1;
    const nextIndex = cursor < assigned.length ? cursor : -1;
    const count = runEnd - runStart + 1;
    let rangeStart = previousIndex >= 0 ? (assigned[previousIndex]?.end ?? 0) : 0;
    let step = defaultDuration;

    if (nextIndex >= 0 && assigned[nextIndex]) {
      const nextStart = assigned[nextIndex]?.start ?? rangeStart;
      const availableSpan = nextStart - rangeStart;

      if (availableSpan >= count * MIN_WORD_DURATION_SECONDS) {
        step = Math.max(MIN_WORD_DURATION_SECONDS, availableSpan / count);
      } else {
        step = MIN_WORD_DURATION_SECONDS;
        rangeStart = Math.max(0, nextStart - (step * count));
      }
    } else if (previousIndex >= 0 && assigned[previousIndex]) {
      rangeStart = assigned[previousIndex]?.end ?? rangeStart;
    }

    for (let offset = 0; offset < count; offset += 1) {
      const sourceToken = sourceTokens[runStart + offset];
      const start = rangeStart + (offset * step);
      const end = start + step;

      assigned[runStart + offset] = {
        end,
        start,
        text: sourceToken.display,
      };
    }
  }

  return assigned.map((word) => word ?? { end: 0, start: 0, text: "" });
}

function estimateTimingDriftSeconds(matches: MatchRecord[], transcriptTokens: TranscriptToken[]): number[] {
  if (matches.length < 3) {
    return [];
  }

  const drifts: number[] = [];

  for (let index = 1; index < matches.length - 1; index += 1) {
    const previous = matches[index - 1];
    const current = matches[index];
    const next = matches[index + 1];
    const span = next.sourceIndex - previous.sourceIndex;

    if (span <= 1) {
      continue;
    }

    const progress = (current.sourceIndex - previous.sourceIndex) / span;
    const expectedStart = transcriptTokens[previous.transcriptIndex].word.start
      + ((transcriptTokens[next.transcriptIndex].word.start - transcriptTokens[previous.transcriptIndex].word.start) * progress);
    const actualStart = transcriptTokens[current.transcriptIndex].word.start;
    drifts.push(Math.abs(actualStart - expectedStart));
  }

  return drifts;
}

function toLine(
  sourceLine: SourceLine,
  alignedWords: VisualEngineLyricsWord[],
): VisualEngineLyricsLine {
  const words = sourceLine.tokens.map((token) => alignedWords[token.index]);

  return {
    end: words[words.length - 1]?.end ?? 0,
    index: sourceLine.index,
    start: words[0]?.start ?? 0,
    text: sourceLine.text,
    words,
  };
}

export function alignLyricsToSource({
  audioPath,
  sourceLyricsText,
  transcriptWords,
}: {
  audioPath: string;
  sourceLyricsText: string;
  transcriptWords: VisualEngineLyricsWord[];
}): LyricsAlignmentResult {
  const sourceLines = flattenSourceLyrics(sourceLyricsText);
  const sourceTokens = sourceLines.flatMap((line) => line.tokens);
  const transcriptTokens = normalizeTranscriptWords(transcriptWords);

  if (sourceTokens.length === 0 || transcriptTokens.length === 0) {
    return {
      alignedLines: [],
      report: {
        averageTimingDriftSeconds: 0,
        confidenceScore: 0,
        hallucinatedWords: [],
        lineReports: [],
        matchedWordCount: 0,
        maxTimingDriftSeconds: 0,
        missingWords: sourceTokens.map((token) => ({ lineIndex: token.lineIndex + 1, text: token.display })),
        sourceWordCount: sourceTokens.length,
        transcriptWordCount: transcriptTokens.length,
        unalignedTranscriptWordCount: transcriptTokens.length,
      },
      transcriptText: transcriptWords.map((word) => word.text).join(" "),
    };
  }

  const matches = buildAlignmentMatches(sourceTokens, transcriptTokens);
  const alignedWords = assignInterpolatedWordTimes(sourceTokens, transcriptTokens, matches);
  const matchedSourceIndexes = new Set(matches.map((match) => match.sourceIndex));
  const matchedTranscriptIndexes = new Set(matches.map((match) => match.transcriptIndex));
  const similarityBySourceIndex = new Map(matches.map((match) => [match.sourceIndex, match.similarity]));
  const driftSamples = estimateTimingDriftSeconds(matches, transcriptTokens);
  const exactMatchCount = matches.filter((match) => match.similarity >= 0.98).length;
  const fuzzyMatchCount = matches.length - exactMatchCount;
  const missingWords = sourceTokens
    .filter((token) => !matchedSourceIndexes.has(token.index))
    .map((token) => ({ lineIndex: token.lineIndex + 1, text: token.display }));
  const hallucinatedWords = transcriptTokens
    .filter((token) => !matchedTranscriptIndexes.has(token.index))
    .map((token) => token.word.text);
  const coverageRatio = matches.length / sourceTokens.length;
  const exactRatio = exactMatchCount / sourceTokens.length;
  const fuzzyRatio = fuzzyMatchCount / sourceTokens.length;
  const hallucinationRatio = transcriptTokens.length > 0
    ? hallucinatedWords.length / transcriptTokens.length
    : 0;
  const confidenceScore = Math.max(
    0,
    Math.min(1, (coverageRatio * 0.65) + (exactRatio * 0.2) + (fuzzyRatio * 0.08) - (hallucinationRatio * 0.18)),
  );
  const alignedLines = sourceLines.map((line) => toLine(line, alignedWords));
  const lineReports = sourceLines.map((line) => {
    const matchedCount = line.tokens.filter((token) => matchedSourceIndexes.has(token.index)).length;
    const lineConfidence = line.tokens.length > 0
      ? line.tokens.reduce((sum, token) => sum + (similarityBySourceIndex.get(token.index) ?? 0), 0) / line.tokens.length
      : 0;
    const lineMatches = matches.filter((match) => sourceTokens[match.sourceIndex]?.lineIndex === line.index - 1);
    const lineDrifts = estimateTimingDriftSeconds(lineMatches, transcriptTokens);

    return {
      confidenceScore: Number(lineConfidence.toFixed(3)),
      index: line.index,
      matchedWordCount: matchedCount,
      missingWords: line.tokens
        .filter((token) => !matchedSourceIndexes.has(token.index))
        .map((token) => token.display),
      text: line.text,
      timingDriftSeconds: Number((lineDrifts.length > 0 ? median(lineDrifts) : 0).toFixed(3)),
    } satisfies LineTimingReport;
  });

  return {
    alignedLines,
    report: {
      averageTimingDriftSeconds: Number((driftSamples.length > 0 ? median(driftSamples) : 0).toFixed(3)),
      confidenceScore: Number(confidenceScore.toFixed(3)),
      hallucinatedWords,
      lineReports,
      matchedWordCount: matches.length,
      maxTimingDriftSeconds: Number((driftSamples.length > 0 ? Math.max(...driftSamples) : 0).toFixed(3)),
      missingWords,
      sourceWordCount: sourceTokens.length,
      transcriptWordCount: transcriptTokens.length,
      unalignedTranscriptWordCount: hallucinatedWords.length,
    },
    transcriptText: transcriptWords.map((word) => word.text).join(" "),
  };
}

export function getAlignedLyricsFileName(): string {
  return "lyrics-aligned.json";
}

export function getAlignedLyricsFileLabel(audioPath: string): string {
  return path.basename(audioPath);
}