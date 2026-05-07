import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PromptGenerationInput = {
  concept: string;
  durationSeconds?: number;
  genre?: string;
  mood?: string;
  styleReferences?: string;
  title: string;
};

export type CreativePromptPack = {
  imagePrompts: string[];
  sunoPrompt: string;
  udioPrompt: string;
  videoPrompts: string[];
};

export type MusicVideoPipelinePlan = {
  concept: string;
  nextActions: string;
  promptPack: CreativePromptPack;
  requiredAssets: string;
  risks: string;
  summary: string;
  title: string;
};

export type ComfyUIOutput = {
  filename: string;
  subfolder: string;
  type: string;
  url: string;
};

export type CreativeRuntimeConfig = {
  comfyuiUrl: string;
  ffmpegPath: string;
  outputDirectory: string;
};

export type MusicVideoBuilderInput = {
  audioPath: string;
  durationSeconds?: number;
  sourceImagePath?: string;
  title: string;
  visualPrompt: string;
  workflow: Record<string, unknown>;
};

export type MusicVideoBuilderOutput = {
  finalMp4Path: string;
  promptId: string;
  releaseFiles: string[];
  releasePackageDir: string;
  renderedVideoPath: string;
};

type FetchLike = typeof fetch;

type CommandExecutor = (
  executable: string,
  args: string[],
  options: { cwd?: string; timeout?: number; windowsHide?: boolean },
) => Promise<{ stderr?: string; stdout?: string }>;

function cleanPhrase(value: string | undefined, fallback: string): string {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

async function assertExecutable(filePath: string, label: string): Promise<void> {
  if (filePath === "ffmpeg") {
    return;
  }

  try {
    await access(filePath, constants.X_OK);
  } catch {
    throw new Error(`${label} is missing or not executable: ${filePath}`);
  }
}

function asPositiveDuration(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 180;
}

async function assertReadableFile(filePath: string, label: string): Promise<void> {
  try {
    const info = await stat(filePath);

    if (!info.isFile()) {
      throw new Error(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("is not a file")) {
      throw error;
    }

    throw new Error(`${label} is missing: ${filePath}`);
  }
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function loadCreativeRuntimeConfig({
  configPath = path.join(process.cwd(), ".creation-station", "creative-runtime.json"),
  env = process.env,
}: {
  configPath?: string;
  env?: Partial<NodeJS.ProcessEnv>;
} = {}): Promise<CreativeRuntimeConfig> {
  let fileConfig: Partial<CreativeRuntimeConfig> = {};

  try {
    fileConfig = JSON.parse(await readFile(configPath, "utf8")) as Partial<CreativeRuntimeConfig>;
  } catch {
    fileConfig = {};
  }

  const comfyuiUrl = cleanPhrase(
    env.CREATION_STATION_COMFYUI_URL ?? fileConfig.comfyuiUrl,
    "http://127.0.0.1:8188",
  ).replace(/\/+$/, "");
  const ffmpegPath = cleanPhrase(env.CREATION_STATION_FFMPEG_PATH ?? fileConfig.ffmpegPath, "ffmpeg");
  const outputDirectory = path.resolve(
    cleanPhrase(
      env.CREATION_STATION_OUTPUT_DIR ?? fileConfig.outputDirectory,
      path.join(process.cwd(), "output", "creative-runtime"),
    ),
  );

  return {
    comfyuiUrl,
    ffmpegPath,
    outputDirectory,
  };
}

export function generateCreativePrompts(input: PromptGenerationInput): CreativePromptPack {
  const title = cleanPhrase(input.title, "Untitled music video");
  const concept = cleanPhrase(input.concept, "A focused performance-driven music video.");
  const genre = cleanPhrase(input.genre, "cinematic electronic pop");
  const mood = cleanPhrase(input.mood, "emotional, polished, high-energy");
  const styleReferences = cleanPhrase(input.styleReferences, "clean editorial lighting, bold color contrast");
  const duration = asPositiveDuration(input.durationSeconds);

  return {
    sunoPrompt: [
      `${genre} track for "${title}".`,
      `Mood: ${mood}.`,
      `Concept: ${concept}.`,
      "Structure: strong intro, memorable hook, cinematic lift, clean ending.",
      "Production notes: modern mix, clear vocal focus, release-ready dynamics.",
    ].join(" "),
    udioPrompt: [
      `${title} - ${genre}.`,
      `Emotional direction: ${mood}.`,
      `Narrative cue: ${concept}.`,
      "Arrangement should support a music-video edit with clear verse, chorus, bridge, and outro markers.",
    ].join(" "),
    imagePrompts: [
      `Key art for "${title}", ${concept}, ${styleReferences}, poster-quality composition, detailed lighting, no text.`,
      `Album cover concept for "${title}", ${mood}, ${genre}, premium cover art, centered focal subject, no text.`,
      `Storyboard style frame, ${concept}, cinematic lensing, color-graded, production still, no text.`,
    ],
    videoPrompts: [
      `Opening shot for "${title}": ${concept}. ${styleReferences}. Slow camera move, cinematic music-video pacing.`,
      `Performance sequence: ${genre}, ${mood}. Dynamic lighting, clean cuts, expressive subject movement.`,
      `Final ${duration}-second visual loop direction: seamless motion, stable subject continuity, export-ready framing.`,
    ],
  };
}

export function buildMusicVideoPipelinePlan(
  input: PromptGenerationInput,
): MusicVideoPipelinePlan {
  const promptPack = generateCreativePrompts(input);
  const title = cleanPhrase(input.title, "Untitled music video");
  const concept = cleanPhrase(input.concept, "A focused performance-driven music video.");
  const duration = asPositiveDuration(input.durationSeconds);

  return {
    concept: [
      concept,
      "",
      "Prompt pack:",
      `Suno: ${promptPack.sunoPrompt}`,
      `Udio: ${promptPack.udioPrompt}`,
      `Image: ${promptPack.imagePrompts[0]}`,
      `Video: ${promptPack.videoPrompts[0]}`,
    ].join("\n"),
    nextActions: [
      "Generate or select the final audio track from the Suno/Udio prompts.",
      "Submit the visual workflow to ComfyUI and monitor it until outputs are ready.",
      "Collect the selected visual output and source audio in the project source folders.",
      "Use FFmpeg to loop the visual and merge it with the final audio.",
      "Validate the exported render and prepare the release package.",
    ].join("\n"),
    promptPack,
    requiredAssets: [
      "Final mastered audio file",
      "ComfyUI workflow JSON",
      "Selected image or video visual output",
      "Cover image or key art",
      "Release metadata: title, credits, notes, target platform",
    ].join("\n"),
    risks: [
      "ComfyUI may return no outputs or a failed history status.",
      "Audio or visual source files may be missing at render time.",
      "FFmpeg export can fail if codecs, durations, or input paths are invalid.",
      "Release package should not be shipped until the final render validates as non-empty media.",
    ].join("\n"),
    summary: `Create a ${duration}-second music-video execution pipeline for "${title}" with prompt generation, ComfyUI visual output retrieval, FFmpeg render assembly, and release packaging.`,
    title: `Create Music Video Pipeline: ${title}`,
  };
}

export class ComfyUIAdapter {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor({
    baseUrl = "http://127.0.0.1:8188",
    fetchImpl = fetch,
  }: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async submitWorkflow({
    clientId = "creation-station",
    workflow,
  }: {
    clientId?: string;
    workflow: Record<string, unknown>;
  }): Promise<{ promptId: string }> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/prompt`, {
        body: JSON.stringify({ client_id: clientId, prompt: workflow }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      throw new Error(
        `ComfyUI is unavailable at ${this.baseUrl}: ${error instanceof Error ? error.message : "connection failed"}`,
      );
    }

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(
        `ComfyUI workflow submit failed with HTTP ${response.status}${details ? `: ${details}` : "."}`,
      );
    }

    const payload = (await response.json()) as { prompt_id?: unknown };
    const promptId = typeof payload.prompt_id === "string" ? payload.prompt_id : "";

    if (!promptId) {
      throw new Error("ComfyUI did not return a prompt_id.");
    }

    return { promptId };
  }

  async assertRequiredNodes(requiredNodeTypes: string[]): Promise<void> {
    if (requiredNodeTypes.length === 0) {
      return;
    }

    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/object_info`);
    } catch (error) {
      throw new Error(
        `ComfyUI is unavailable at ${this.baseUrl}: ${error instanceof Error ? error.message : "connection failed"}`,
      );
    }

    if (!response.ok) {
      throw new Error(`ComfyUI node lookup failed with HTTP ${response.status}.`);
    }

    const objectInfo = (await response.json()) as Record<string, unknown>;
    const missing = requiredNodeTypes.filter((nodeType) => !(nodeType in objectInfo));

    if (missing.length > 0) {
      throw new Error(`ComfyUI is missing required nodes: ${missing.join(", ")}`);
    }
  }

  async monitorJobCompletion({
    intervalMs = 1_000,
    promptId,
    timeoutMs = 120_000,
  }: {
    intervalMs?: number;
    promptId: string;
    timeoutMs?: number;
  }): Promise<{ history: Record<string, unknown>; promptId: string }> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const history = await this.fetchHistory(promptId);
      const record = history[promptId] as
        | { outputs?: unknown; status?: { completed?: unknown; status_str?: unknown } }
        | undefined;

      if (record?.status?.status_str === "error") {
        throw new Error(`ComfyUI job failed: ${promptId}`);
      }

      if (record?.status?.completed === true || record?.outputs) {
        return { history, promptId };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`ComfyUI job timed out: ${promptId}`);
  }

  async retrieveOutputs(promptId: string): Promise<ComfyUIOutput[]> {
    const history = await this.fetchHistory(promptId);
    const record = history[promptId] as { outputs?: Record<string, unknown> } | undefined;
    const outputs: ComfyUIOutput[] = [];

    for (const nodeOutput of Object.values(record?.outputs ?? {})) {
      if (!nodeOutput || typeof nodeOutput !== "object") {
        continue;
      }

      for (const value of Object.values(nodeOutput as Record<string, unknown>)) {
        if (!Array.isArray(value)) {
          continue;
        }

        for (const item of value) {
          if (!item || typeof item !== "object") {
            continue;
          }

          const output = item as Record<string, unknown>;
          const filename = typeof output.filename === "string" ? output.filename : "";
          const subfolder = typeof output.subfolder === "string" ? output.subfolder : "";
          const type = typeof output.type === "string" ? output.type : "output";

          if (filename) {
            const params = new URLSearchParams({ filename, subfolder, type });
            outputs.push({
              filename,
              subfolder,
              type,
              url: `${this.baseUrl}/view?${params.toString()}`,
            });
          }
        }
      }
    }

    if (outputs.length === 0) {
      throw new Error(`ComfyUI job has no retrievable outputs: ${promptId}`);
    }

    return outputs;
  }

  async downloadOutput({
    output,
    targetPath,
  }: {
    output: ComfyUIOutput;
    targetPath: string;
  }): Promise<string> {
    await ensureParentDirectory(targetPath);

    let response: Response;

    try {
      response = await this.fetchImpl(output.url);
    } catch (error) {
      throw new Error(
        `ComfyUI output download failed for ${output.filename}: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(`ComfyUI output download failed with HTTP ${response.status}: ${output.filename}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0) {
      throw new Error(`ComfyUI output is empty or corrupted: ${output.filename}`);
    }

    await writeFile(targetPath, bytes);
    return targetPath;
  }

  private async fetchHistory(promptId: string): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`);
    } catch (error) {
      throw new Error(
        `ComfyUI history lookup failed because ComfyUI is unavailable at ${this.baseUrl}: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(`ComfyUI history lookup failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export class FFmpegAdapter {
  private readonly executor: CommandExecutor;
  private readonly ffmpegPath: string;

  constructor({
    executor = (executable, args, options) => execFileAsync(executable, args, options),
    ffmpegPath = "ffmpeg",
  }: {
    executor?: CommandExecutor;
    ffmpegPath?: string;
  } = {}) {
    this.executor = executor;
    this.ffmpegPath = ffmpegPath;
  }

  async mergeAudioVideo({
    audioPath,
    outputPath,
    videoPath,
  }: {
    audioPath: string;
    outputPath: string;
    videoPath: string;
  }): Promise<{ outputPath: string; stderr: string; stdout: string }> {
    await Promise.all([
      assertExecutable(this.ffmpegPath, "FFmpeg"),
      assertReadableFile(audioPath, "Audio input"),
      assertReadableFile(videoPath, "Video input"),
      ensureParentDirectory(outputPath),
    ]);

    return this.run([
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      outputPath,
    ], outputPath);
  }

  async loopVisuals({
    durationSeconds,
    inputKind = "video",
    outputPath,
    visualPath,
  }: {
    durationSeconds: number;
    inputKind?: "image" | "video";
    outputPath: string;
    visualPath: string;
  }): Promise<{ outputPath: string; stderr: string; stdout: string }> {
    await Promise.all([
      assertExecutable(this.ffmpegPath, "FFmpeg"),
      assertReadableFile(visualPath, "Visual input"),
      ensureParentDirectory(outputPath),
    ]);

    const inputArgs = inputKind === "image" ? ["-loop", "1", "-i", visualPath] : ["-stream_loop", "-1", "-i", visualPath];

    return this.run([
      "-y",
      ...inputArgs,
      "-t",
      String(asPositiveDuration(durationSeconds)),
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ], outputPath);
  }

  async exportFinalRender({
    audioPath,
    durationSeconds,
    outputPath,
    visualPath,
  }: {
    audioPath: string;
    durationSeconds?: number;
    outputPath: string;
    visualPath: string;
  }): Promise<{ outputPath: string; stderr: string; stdout: string }> {
    await Promise.all([
      assertExecutable(this.ffmpegPath, "FFmpeg"),
      assertReadableFile(audioPath, "Audio input"),
      assertReadableFile(visualPath, "Visual input"),
      ensureParentDirectory(outputPath),
    ]);

    const durationArgs = durationSeconds ? ["-t", String(asPositiveDuration(durationSeconds))] : [];

    return this.run([
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      visualPath,
      "-i",
      audioPath,
      ...durationArgs,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-pix_fmt",
      "yuv420p",
      "-shortest",
      outputPath,
    ], outputPath);
  }

  async validateExport({
    allowedExtensions = [".mp4", ".mov", ".mkv"],
    minBytes = 1,
    outputPath,
  }: {
    allowedExtensions?: string[];
    minBytes?: number;
    outputPath: string;
  }): Promise<{ errors: string[]; ok: boolean; outputPath: string; sizeBytes: number }> {
    const errors: string[] = [];
    let sizeBytes = 0;
    const extension = path.extname(outputPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      errors.push(`Export extension must be one of: ${allowedExtensions.join(", ")}`);
    }

    try {
      const info = await stat(outputPath);
      sizeBytes = info.size;

      if (!info.isFile()) {
        errors.push("Export path is not a file.");
      }

      if (info.size < minBytes) {
        errors.push(`Export is smaller than ${minBytes} bytes.`);
      }

      const header = await readFile(outputPath).then((bytes) => bytes.subarray(0, 12)).catch(() => Buffer.alloc(0));
      if (extension === ".mp4" && info.size > 0 && !header.includes(Buffer.from("ftyp"))) {
        errors.push("Export does not look like a valid MP4 container.");
      }
    } catch {
      errors.push(`Export is missing: ${outputPath}`);
    }

    return {
      errors,
      ok: errors.length === 0,
      outputPath,
      sizeBytes,
    };
  }

  private async run(
    args: string[],
    outputPath: string,
  ): Promise<{ outputPath: string; stderr: string; stdout: string }> {
    let result: { stderr?: string; stdout?: string };

    try {
      result = await this.executor(this.ffmpegPath, args, {
        timeout: 180_000,
        windowsHide: true,
      });
    } catch (error) {
      throw new Error(`FFmpeg render failed: ${error instanceof Error ? error.message : "command failed"}`);
    }

    return { outputPath, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
  }
}

export class AssetPipelineAdapter {
  async organizeProjectFolders({
    projectSlug,
    rootDir = path.join(process.cwd(), "output", "creative-execution"),
  }: {
    projectSlug: string;
    rootDir?: string;
  }): Promise<Record<"comfyui" | "logs" | "prompts" | "release" | "renders" | "source" | "temp", string>> {
    const projectRoot = path.join(rootDir, sanitizeFilePart(projectSlug));
    const folders = {
      comfyui: path.join(projectRoot, "comfyui"),
      logs: path.join(projectRoot, "logs"),
      prompts: path.join(projectRoot, "prompts"),
      release: path.join(projectRoot, "release"),
      renders: path.join(projectRoot, "renders"),
      source: path.join(projectRoot, "source"),
      temp: path.join(projectRoot, "temp"),
    };

    await Promise.all(Object.values(folders).map((folder) => mkdir(folder, { recursive: true })));

    return folders;
  }

  async renameOutputs({
    basename,
    files,
    targetDir,
  }: {
    basename: string;
    files: string[];
    targetDir: string;
  }): Promise<string[]> {
    await mkdir(targetDir, { recursive: true });

    const renamed: string[] = [];

    for (const [index, file] of files.entries()) {
      await assertReadableFile(file, "Output file");
      const extension = path.extname(file);
      const targetPath = path.join(targetDir, `${sanitizeFilePart(basename)}-${index + 1}${extension}`);
      await rename(file, targetPath);
      renamed.push(targetPath);
    }

    return renamed;
  }

  async prepareReleasePackage({
    manifest,
    projectDir,
    promptPack,
    renderPath,
  }: {
    manifest: Record<string, unknown>;
    projectDir: string;
    promptPack: CreativePromptPack;
    renderPath: string;
  }): Promise<{ files: string[]; releaseDir: string }> {
    await assertReadableFile(renderPath, "Final render");
    const releaseDir = path.join(projectDir, "release");
    await mkdir(releaseDir, { recursive: true });

    const finalRenderPath = path.join(releaseDir, `final-render${path.extname(renderPath)}`);
    const promptPackPath = path.join(releaseDir, "prompt-pack.json");
    const manifestPath = path.join(releaseDir, "manifest.json");

    await Promise.all([
      copyFile(renderPath, finalRenderPath),
      writeFile(promptPackPath, JSON.stringify(promptPack, null, 2), "utf8"),
      writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8"),
    ]);

    return {
      files: [finalRenderPath, promptPackPath, manifestPath],
      releaseDir,
    };
  }
}

export async function runMusicVideoBuilderV1({
  adapters,
  config,
  input,
}: {
  adapters?: {
    assets?: AssetPipelineAdapter;
    comfyui?: ComfyUIAdapter;
    ffmpeg?: FFmpegAdapter;
  };
  config?: CreativeRuntimeConfig;
  input: MusicVideoBuilderInput;
}): Promise<MusicVideoBuilderOutput> {
  const runtimeConfig = config ?? await loadCreativeRuntimeConfig();
  const assets = adapters?.assets ?? new AssetPipelineAdapter();
  const comfyui = adapters?.comfyui ?? new ComfyUIAdapter({ baseUrl: runtimeConfig.comfyuiUrl });
  const ffmpeg = adapters?.ffmpeg ?? new FFmpegAdapter({ ffmpegPath: runtimeConfig.ffmpegPath });
  const promptPack = generateCreativePrompts({
    concept: input.visualPrompt,
    durationSeconds: input.durationSeconds,
    title: input.title,
  });
  const projectFolders = await assets.organizeProjectFolders({
    projectSlug: input.title,
    rootDir: runtimeConfig.outputDirectory,
  });

  await assertReadableFile(input.audioPath, "Audio input");
  if (input.sourceImagePath) {
    await assertReadableFile(input.sourceImagePath, "Source image");
  }

  const submit = await comfyui.submitWorkflow({ workflow: input.workflow });
  await comfyui.monitorJobCompletion({ promptId: submit.promptId });
  const [firstOutput] = await comfyui.retrieveOutputs(submit.promptId);

  if (!firstOutput) {
    throw new Error(`ComfyUI job has no retrievable outputs: ${submit.promptId}`);
  }

  const renderedVideoPath = await comfyui.downloadOutput({
    output: firstOutput,
    targetPath: path.join(projectFolders.comfyui, firstOutput.filename),
  });
  const finalMp4Path = path.join(projectFolders.renders, "final.mp4");

  await ffmpeg.exportFinalRender({
    audioPath: input.audioPath,
    durationSeconds: input.durationSeconds,
    outputPath: finalMp4Path,
    visualPath: renderedVideoPath,
  });

  const validation = await ffmpeg.validateExport({
    minBytes: 12,
    outputPath: finalMp4Path,
  });

  if (!validation.ok) {
    await recoverFailedRender({
      outputPath: finalMp4Path,
      reason: validation.errors.join(" "),
    });
    throw new Error(`Final MP4 validation failed: ${validation.errors.join(" ")}`);
  }

  const release = await assets.prepareReleasePackage({
    manifest: {
      audioPath: input.audioPath,
      comfyuiOutput: firstOutput,
      promptId: submit.promptId,
      sourceImagePath: input.sourceImagePath ?? null,
      title: input.title,
      visualPrompt: input.visualPrompt,
    },
    projectDir: path.dirname(projectFolders.release),
    promptPack,
    renderPath: finalMp4Path,
  });

  return {
    finalMp4Path,
    promptId: submit.promptId,
    releaseFiles: release.files,
    releasePackageDir: release.releaseDir,
    renderedVideoPath,
  };
}

export async function recoverFailedRender({
  outputPath,
  reason,
  recoveryDir = path.join(path.dirname(outputPath), "failed"),
}: {
  outputPath: string;
  reason: string;
  recoveryDir?: string;
}): Promise<{ manifestPath: string; recoveredPath: string | null }> {
  await mkdir(recoveryDir, { recursive: true });

  let recoveredPath: string | null = null;

  try {
    await assertReadableFile(outputPath, "Partial render");
    recoveredPath = path.join(
      recoveryDir,
      `${sanitizeFilePart(path.basename(outputPath, path.extname(outputPath)))}-${Date.now()}${path.extname(outputPath)}.failed`,
    );
    await rename(outputPath, recoveredPath);
  } catch {
    recoveredPath = null;
  }

  const manifestPath = path.join(recoveryDir, `recovery-${Date.now()}.json`);
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        originalOutputPath: outputPath,
        reason,
        recoveredAt: new Date().toISOString(),
        recoveredPath,
      },
      null,
      2,
    ),
    "utf8",
  );

  return { manifestPath, recoveredPath };
}
