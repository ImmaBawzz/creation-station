import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";

type LyricsGeneratorInput = VisualEngineLyricsLine[] | {
  alignedLines?: VisualEngineLyricsLine[];
  fallbackLines: VisualEngineLyricsLine[];
};

function resolvePreferredLines(input: LyricsGeneratorInput): VisualEngineLyricsLine[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (input.alignedLines && input.alignedLines.length > 0) {
    return input.alignedLines;
  }

  return input.fallbackLines;
}

function formatSrtTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const milliseconds = totalMilliseconds % 1_000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

export function generateSrt(input: LyricsGeneratorInput): string {
  const lines = resolvePreferredLines(input);
  const body = lines
    .map((line) => [
      `${line.index}`,
      `${formatSrtTimestamp(line.start)} --> ${formatSrtTimestamp(line.end)}`,
      line.text,
    ].join("\n"))
    .join("\n\n");

  return `${body}\n`;
}