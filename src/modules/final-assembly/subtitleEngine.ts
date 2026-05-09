import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FinalAssemblySubtitleArtifact,
  FinalAssemblySubtitleCue,
  SubtitleMode,
} from "@/modules/final-assembly/types";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";

function toAssTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const remainingSeconds = clamped % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${remainingSeconds.toFixed(2).padStart(5, "0")}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

export function buildSubtitleCues(lines: VisualEngineLyricsLine[]): FinalAssemblySubtitleCue[] {
  return lines.map((line) => ({
    end: line.end,
    lineIndex: line.index,
    safeZoneMarginV: 90,
    start: line.start,
    text: line.text,
    words: line.words.map((word) => ({
      end: word.end,
      start: word.start,
      text: word.text,
    })),
  }));
}

function formatDialogue(cue: FinalAssemblySubtitleCue, mode: SubtitleMode): string {
  if (mode === "karaoke") {
    const karaokeText = cue.words.map((word) => {
      const centiseconds = Math.max(1, Math.round((word.end - word.start) * 100));
      return `{\\k${centiseconds}}${escapeAssText(word.text)}`;
    }).join(" ");
    return `Dialogue: 0,${toAssTimestamp(cue.start)},${toAssTimestamp(cue.end)},Default,,0,0,0,,${karaokeText}`;
  }

  if (mode === "cinematic") {
    return `Dialogue: 0,${toAssTimestamp(cue.start)},${toAssTimestamp(cue.end)},Default,,0,0,0,,{\\blur2} ${escapeAssText(cue.text)}`;
  }

  return `Dialogue: 0,${toAssTimestamp(cue.start)},${toAssTimestamp(cue.end)},Default,,0,0,0,,{\\bord3} ${escapeAssText(cue.text)}`;
}

function buildAssFile(cues: FinalAssemblySubtitleCue[], mode: SubtitleMode, safeZoneMarginV: number): string {
  const alignment = mode === "cinematic" ? 2 : 8;
  const outline = mode === "lyric-highlight" ? 3 : 2;
  const fontSize = mode === "cinematic" ? 40 : 46;

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H00111111,&H64000000,-1,0,0,0,100,100,0,0,1,${outline},0,${alignment},80,80,${safeZoneMarginV},1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  ];

  const lines = cues.map((cue) => formatDialogue({ ...cue, safeZoneMarginV }, mode));
  return `${[...header, ...lines].join("\n")}\n`;
}

export async function writeSubtitleArtifacts(
  cues: FinalAssemblySubtitleCue[],
  outputDirectory: string,
  modes: SubtitleMode[],
): Promise<FinalAssemblySubtitleArtifact[]> {
  await mkdir(outputDirectory, { recursive: true });

  const artifacts: FinalAssemblySubtitleArtifact[] = [];

  for (const mode of modes) {
    const safeZoneMarginV = mode === "lyric-highlight" ? 120 : 90;
    const absolutePath = path.join(outputDirectory, `${mode}.ass`);
    await writeFile(absolutePath, buildAssFile(cues, mode, safeZoneMarginV), "utf8");
    artifacts.push({
      mode,
      outputPath: relativeProjectPath(absolutePath),
      safeZoneMarginV,
    });
  }

  return artifacts;
}