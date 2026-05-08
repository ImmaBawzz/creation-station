import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { getMusicVideoWorkflowPreset } from "@/lib/music-video-workflows";

const execFileAsync = promisify(execFile);

const DEMO_LYRICS = [
  "[Intro]",
  "I saw the skyline flicker in the rain",
  "One small light calling out my name",
  "",
  "[Verse 1]",
  "I walked alone through the electric blue",
  "Every window held a ghost of you",
  "Neon rivers running down the street",
  "Like broken stars beneath my feet",
  "",
  "[Chorus]",
  "Signal fire, carry me home",
  "Signal fire, I am not alone",
].join("\n");

const SCENES = [
  {
    accent_color: "#5EEAD4",
    color: "#101820",
    name: "Opening pulse",
  },
  {
    accent_color: "#F4D35E",
    color: "#1D2B53",
    name: "Verse drift",
  },
  {
    accent_color: "#F15BB5",
    color: "#2F184B",
    name: "Chorus lift",
  },
  {
    accent_color: "#FF9F1C",
    color: "#0B3D2E",
    name: "Final glow",
  },
];

type BuilderApiResponse =
  | {
      logPath: string;
      message: string;
      ok: true;
      outputPath: string;
      status: "completed";
      timingPreviewPath: string;
      workflowConfigPath: string;
    }
  | {
      details: string;
      error: string;
      ok: false;
      status: "failed";
    };

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonResponse(payload: BuilderApiResponse, status = 200): NextResponse<BuilderApiResponse> {
  return NextResponse.json(payload, { status });
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);

  return normalized || "lyric_video";
}

function safeExtension(file: File, fallback: string, allowed: string[]): string {
  const extension = path.extname(file.name || "").toLowerCase();
  return allowed.includes(extension) ? extension : fallback;
}

function repoPath(...parts: string[]): string {
  return path.join(process.cwd(), ...parts);
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function uniqueAssetPath(directory: string, basename: string, extension: string): Promise<string> {
  const direct = path.join(directory, `${basename}${extension}`);
  if (!await fileExists(direct)) {
    return direct;
  }

  const suffix = `${Date.now().toString(36)}_${createHash("sha1").update(`${basename}:${Date.now()}`).digest("hex").slice(0, 6)}`;
  return path.join(directory, `${basename}_${suffix}${extension}`);
}

async function persistUpload({
  basename,
  directory,
  fallbackExtension,
  file,
  allowedExtensions,
}: {
  allowedExtensions: string[];
  basename: string;
  directory: string;
  fallbackExtension: string;
  file: File;
}): Promise<string> {
  await mkdir(directory, { recursive: true });
  const extension = safeExtension(file, fallbackExtension, allowedExtensions);
  const targetPath = await uniqueAssetPath(directory, basename, extension);
  await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));
  return relativePath(targetPath);
}

async function persistLyrics({
  file,
  lyricsText,
  slug,
}: {
  file: FormDataEntryValue | null;
  lyricsText: string;
  slug: string;
}): Promise<{ fallbackUsed: boolean; lyricsPath: string }> {
  const lyricsDirectory = repoPath("input", "lyrics");
  await mkdir(lyricsDirectory, { recursive: true });
  let content = lyricsText.trim();
  let fallbackUsed = false;

  if (file instanceof File && file.size > 0) {
    content = Buffer.from(await file.arrayBuffer()).toString("utf8").trim();
  }

  if (!content) {
    content = DEMO_LYRICS;
    fallbackUsed = true;
  }

  const targetPath = await uniqueAssetPath(lyricsDirectory, `${slug}_lyrics`, ".txt");
  await writeFile(targetPath, `${content}\n`, "utf8");

  return {
    fallbackUsed,
    lyricsPath: relativePath(targetPath),
  };
}

async function assertCommandAvailable(command: string): Promise<void> {
  try {
    await execFileAsync(process.platform === "win32" ? "where.exe" : "which", [command], {
      windowsHide: true,
    });
  } catch {
    throw new Error(`${command} was not found on PATH.`);
  }
}

async function assertConfigReadable(configPath: string): Promise<void> {
  try {
    await access(configPath);
  } catch {
    throw new Error(`Workflow config was not written: ${relativePath(configPath)}`);
  }
}

async function runWorkflowScript(args: string[]): Promise<{ stderr: string; stdout: string }> {
  try {
    const result = await execFileAsync("python", ["scripts/run_lyric_video_workflow.py", ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 20,
      timeout: 1000 * 60 * 30,
      windowsHide: true,
    });
    return {
      stderr: result.stderr ?? "",
      stdout: result.stdout ?? "",
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : "Python workflow failed.";
    const stdout = typeof (error as { stdout?: unknown }).stdout === "string"
      ? (error as { stdout: string }).stdout
      : "";
    const stderr = typeof (error as { stderr?: unknown }).stderr === "string"
      ? (error as { stderr: string }).stderr
      : "";
    throw new Error([details, stdout, stderr].filter(Boolean).join("\n"));
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = clean(formData.get("title")) || "Untitled Music Video";
    const slug = slugify(title);
    const visualPrompt = clean(formData.get("visualPrompt")) || "Controlled lyric video test visuals.";
    const lyricsText = clean(formData.get("lyricsText"));
    const workflowPresetId = clean(formData.get("workflowPreset"));
    const durationSecondsRaw = Number(clean(formData.get("durationSeconds")));
    const audio = formData.get("audio");
    const sourceImage = formData.get("sourceImage");
    const preset = getMusicVideoWorkflowPreset(workflowPresetId);

    if (!(audio instanceof File) || audio.size <= 0) {
      return jsonResponse({
        details: "Upload an audio file before creating the package.",
        error: "Audio upload is required.",
        ok: false,
        status: "failed",
      }, 400);
    }

    if (!preset) {
      return jsonResponse({
        details: "Choose one of the available workflow presets.",
        error: "Workflow preset is required.",
        ok: false,
        status: "failed",
      }, 400);
    }

    await Promise.all([
      mkdir(repoPath("input", "audio"), { recursive: true }),
      mkdir(repoPath("input", "images"), { recursive: true }),
      mkdir(repoPath("output", "renders"), { recursive: true }),
      mkdir(repoPath("output", "logs"), { recursive: true }),
      mkdir(repoPath("output", "temp"), { recursive: true }),
      assertCommandAvailable("ffmpeg"),
      assertCommandAvailable("ffprobe"),
    ]);

    const audioPath = await persistUpload({
      allowedExtensions: [".aac", ".aiff", ".flac", ".m4a", ".mp3", ".ogg", ".wav"],
      basename: slug,
      directory: repoPath("input", "audio"),
      fallbackExtension: ".mp3",
      file: audio,
    });
    const imagePath = sourceImage instanceof File && sourceImage.size > 0
      ? await persistUpload({
          allowedExtensions: [".bmp", ".jpeg", ".jpg", ".png", ".webp"],
          basename: `${slug}_start_image`,
          directory: repoPath("input", "images"),
          fallbackExtension: ".png",
          file: sourceImage,
        })
      : "";
    const lyrics = await persistLyrics({
      file: formData.get("lyricsFile"),
      lyricsText,
      slug,
    });

    const outputPath = `output/renders/${slug}_lyric_video.mp4`;
    const configPath = repoPath("output", "temp", `${slug}_workflow.json`);
    const workflowConfig = {
      audio_file: audioPath,
      duration: Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
        ? Math.round(durationSecondsRaw)
        : null,
      fps: 30,
      lyric_overlay_enabled: true,
      lyrics_file: lyrics.lyricsPath,
      output_file: outputPath,
      output_format: "mp4",
      project_name: slug,
      render_settings: {
        audio_bitrate: "192k",
        audio_codec: "aac",
        crf: 20,
        preset: "medium",
        temp_dir: "output/temp",
        transition: "cut",
        video_codec: "libx264",
      },
      resolution: [1920, 1080],
      scene_count: 4,
      scene_duration_strategy: "even",
      scenes: SCENES,
      start_image: imagePath,
      visual_prompt: visualPrompt,
      visual_source: imagePath ? "start_image" : "placeholder",
      visual_style: visualPrompt,
      workflow_preset: preset.label,
    };

    await writeFile(configPath, JSON.stringify(workflowConfig, null, 2), "utf8");
    await assertConfigReadable(configPath);

    await runWorkflowScript(["--config", relativePath(configPath), "--dry-run"]);
    await runWorkflowScript(["--config", relativePath(configPath)]);

    const logPath = `output/logs/${slug}_render_log.txt`;
    const timingPreviewPath = `output/temp/${slug}_lyric_timing_preview.json`;

    return jsonResponse({
      logPath,
      message: lyrics.fallbackUsed
        ? "Render completed with fallback demo lyrics."
        : "Render completed.",
      ok: true,
      outputPath,
      status: "completed",
      timingPreviewPath,
      workflowConfigPath: relativePath(configPath),
    });
  } catch (error) {
    return jsonResponse({
      details: error instanceof Error ? error.message : "Unknown music video workflow failure.",
      error: "Music video workflow failed.",
      ok: false,
      status: "failed",
    }, 500);
  }
}
