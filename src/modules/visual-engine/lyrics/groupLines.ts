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

function groupWithSourceLyrics(words: VisualEngineLyricsWord[], sourceLyricsText: string): VisualEngineLyricsLine[] {
  const sourceLines = sourceLyricsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sourceLines.length === 0) {
    return [];
  }

  const lines: VisualEngineLyricsLine[] = [];
  let cursor = 0;

  sourceLines.forEach((sourceLine, index) => {
    if (cursor >= words.length) {
      return;
    }

    const desiredWordCount = Math.max(tokenize(sourceLine).length, 1);
    const remainingWords = words.length - cursor;
    const remainingLines = sourceLines.length - index;
    const assignedWordCount = index === sourceLines.length - 1
      ? remainingWords
      : Math.min(desiredWordCount, Math.max(1, remainingWords - (remainingLines - 1)));
    const lineWords = words.slice(cursor, cursor + assignedWordCount);

    if (lineWords.length === 0) {
      return;
    }

    lines.push(createLine(lines.length + 1, sourceLine, lineWords));
    cursor += assignedWordCount;
  });

  if (cursor < words.length) {
    const trailingWords = words.slice(cursor);
    const trailingText = trailingWords.map((word) => word.text).join(" ");
    lines.push(createLine(lines.length + 1, trailingText, trailingWords));
  }

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