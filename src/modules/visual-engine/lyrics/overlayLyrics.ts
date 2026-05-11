import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";
const DEFAULT_FPS = 30;

type OverlayLyricsError = Error & {
  details?: string[];
  statusCode?: number;
};

function createOverlayLyricsError(message: string, statusCode = 400, details?: string[]): OverlayLyricsError {
  const error = new Error(message) as OverlayLyricsError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function escapeSubtitlePath(subtitlePath: string): string {
  return subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

export async function overlayLyrics({
  audioPath,
  outputPath,
  subtitlePath,
  videoPath,
}: {
  audioPath: string;
  outputPath: string;
  subtitlePath: string;
  videoPath: string;
}): Promise<void> {
  try {
    await execFileAsync(
      DEFAULT_FFMPEG_PATH,
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-vf",
        `subtitles='${escapeSubtitlePath(subtitlePath)}'`,
        "-shortest",
        "-r",
        `${DEFAULT_FPS}`,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "320k",
        outputPath,
      ],
      { windowsHide: true },
    );
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & { stderr?: string };

    if (commandError?.code === "ENOENT") {
      throw createOverlayLyricsError(
        "FFmpeg is not available. Set FFMPEG_PATH to a valid executable before rendering.",
        503,
        [`Missing executable: ${DEFAULT_FFMPEG_PATH}`],
      );
    }

    throw createOverlayLyricsError(
      `FFmpeg subtitle overlay failed: ${commandError?.stderr?.trim() || commandError?.message || "command failed"}`,
      500,
    );
  }
}