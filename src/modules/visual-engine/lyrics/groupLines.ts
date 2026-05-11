import type { VisualEngineLyricsLine, VisualEngineLyricsWord } from "@/modules/visual-engine/types";

type GroupLyricsLinesOptions = {
  sourceLyricsText?: string | null;
};

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function createLine(index: number, text: string, words: VisualEngineLyricsWord[]): VisualEngineLyricsLine {
  return {
    end: words[words.length - 1]?.end ?? 0,
    index,
    start: words[0]?.start ?? 0,
    text,
    words,
  };
}

function scoreCandidateWindow(sourceTokens: string[], candidateWords: VisualEngineLyricsWord[]): number {
  const candidateTokens = candidateWords.map((word) => normalizeToken(word.text)).filter(Boolean);

  if (candidateTokens.length === 0) {
    return 0;
  }

  let sequentialMatches = 0;
  let candidateIndex = 0;

  for (const token of sourceTokens) {
    while (candidateIndex < candidateTokens.length && candidateTokens[candidateIndex] !== token) {
      candidateIndex += 1;
    }

    if (candidateIndex < candidateTokens.length) {
      sequentialMatches += 1;
      candidateIndex += 1;
    }
  }

  const sharedTokenCount = candidateTokens.filter((token) => sourceTokens.includes(token)).length;
  const precision = sharedTokenCount / candidateTokens.length;
  const recall = sharedTokenCount / sourceTokens.length;
  const sequentialScore = sequentialMatches / sourceTokens.length;

  return (precision * 0.35) + (recall * 0.35) + (sequentialScore * 0.3);
}

function groupWithSourceLyrics(words: VisualEngineLyricsWord[], sourceLyricsText: string): VisualEngineLyricsLine[] {
  const sourceLines = sourceLyricsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sourceLines.length === 0) {
    return [];
  }

  const lines: VisualEngineLyricsLine[] = [];
  let searchCursor = 0;

  sourceLines.forEach((sourceLine, index) => {
    const sourceTokens = tokenize(sourceLine);

    if (sourceTokens.length === 0 || searchCursor >= words.length) {
      return;
    }

    let bestStart = searchCursor;
    let bestEnd = Math.min(words.length, searchCursor + sourceTokens.length);
    let bestScore = -1;
    const minWindowSize = Math.max(1, sourceTokens.length - 2);
    const maxWindowSize = Math.min(words.length - searchCursor, sourceTokens.length + 3);
    const maxStartIndex = Math.min(words.length - 1, searchCursor + 18);

    for (let startIndex = searchCursor; startIndex <= maxStartIndex; startIndex += 1) {
      for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize += 1) {
        const endIndex = startIndex + windowSize;

        if (endIndex > words.length) {
          break;
        }

        const candidateWords = words.slice(startIndex, endIndex);
        const score = scoreCandidateWindow(sourceTokens, candidateWords);

        if (score > bestScore) {
          bestScore = score;
          bestStart = startIndex;
          bestEnd = endIndex;
        }
      }
    }

    const groupedWords = words.slice(bestStart, bestEnd);

    if (groupedWords.length === 0) {
      return;
    }

    lines.push(createLine(index + 1, sourceLine, groupedWords));
    searchCursor = Math.max(bestEnd, searchCursor + 1);
  });

  return lines;
}

function groupByTiming(words: VisualEngineLyricsWord[]): VisualEngineLyricsLine[] {
  const lines: VisualEngineLyricsLine[] = [];
  let currentLineWords: VisualEngineLyricsWord[] = [];

  for (const word of words) {
    const previousWord = currentLineWords[currentLineWords.length - 1];
    const currentTextLength = currentLineWords.map((entry) => entry.text).join(" ").length;
    const gapSeconds = previousWord ? word.start - previousWord.end : 0;
    const shouldBreak = currentLineWords.length > 0
      && (gapSeconds > 0.85 || currentLineWords.length >= 7 || currentTextLength + word.text.length > 42);

    if (shouldBreak) {
      lines.push(
        createLine(
          lines.length + 1,
          currentLineWords.map((entry) => entry.text).join(" "),
          currentLineWords,
        ),
      );
      currentLineWords = [];
    }

    currentLineWords.push(word);
  }

  if (currentLineWords.length > 0) {
    lines.push(
      createLine(
        lines.length + 1,
        currentLineWords.map((entry) => entry.text).join(" "),
        currentLineWords,
      ),
    );
  }

  return lines;
}

export function groupLyricsLines(
  words: VisualEngineLyricsWord[],
  options: GroupLyricsLinesOptions = {},
): VisualEngineLyricsLine[] {
  if (options.sourceLyricsText) {
    const sourceGroupedLines = groupWithSourceLyrics(words, options.sourceLyricsText);

    if (sourceGroupedLines.length > 0) {
      return sourceGroupedLines;
    }
  }

  return groupByTiming(words);
}