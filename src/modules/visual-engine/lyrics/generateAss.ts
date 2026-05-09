import type { VisualEngineLyricsLine, VisualEngineLyricsWord } from "@/modules/visual-engine/types";

function formatAssTimestamp(seconds: number): string {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(totalCentiseconds / 360_000);
  const minutes = Math.floor((totalCentiseconds % 360_000) / 6_000);
  const remainingSeconds = Math.floor((totalCentiseconds % 6_000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}

function karaokeWord(word: VisualEngineLyricsWord): string {
  const duration = Math.max(1, Math.round((word.end - word.start) * 100));
  return `{\\k${duration}}${escapeAssText(word.text)}`;
}

function lineToDialogue(line: VisualEngineLyricsLine): string {
  return `Dialogue: 0,${formatAssTimestamp(line.start)},${formatAssTimestamp(line.end)},Default,,0,0,0,,${line.words
    .map(karaokeWord)
    .join(" ")}`;
}

export function generateAss(lines: VisualEngineLyricsLine[]): string {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,54,&H00FFFFFF,&H0000D7FF,&H00101010,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,96,96,90,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const body = lines.map(lineToDialogue).join("\n");

  return `${header}\n${body}\n`;
}