import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  getVisualProjectAssetFolders,
  getVisualProjectManifestPath,
  getVisualProjectRoot,
  resolveVisualProjectPath,
  VISUAL_ENGINE_PROJECTS_ROOT,
} from "@/modules/visual-engine/paths";
import type { VisualEngineProjectManifest } from "@/modules/visual-engine/types";

const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".wav"]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const SUPPORTED_LYRICS_EXTENSIONS = new Set([".txt"]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parseProjectManifest(payload: unknown): VisualEngineProjectManifest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.kind !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.outputFolder !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !(candidate.audioFile === null || typeof candidate.audioFile === "string") ||
    !(candidate.lyricsFile === null || typeof candidate.lyricsFile === "string") ||
    !isStringArray(candidate.imageFiles) ||
    !isStringArray(candidate.videoFiles)
  ) {
    return null;
  }

  return {
    audioFile: candidate.audioFile,
    createdAt: candidate.createdAt,
    id: candidate.id,
    imageFiles: candidate.imageFiles,
    kind: candidate.kind,
    lyricsFile: candidate.lyricsFile,
    name: candidate.name,
    outputFolder: candidate.outputFolder,
    status: candidate.status,
    updatedAt: candidate.updatedAt,
    videoFiles: candidate.videoFiles,
  };
}

export async function readVisualProjectManifest(
  projectId: string,
): Promise<VisualEngineProjectManifest | null> {
  try {
    const file = await readFile(getVisualProjectManifestPath(projectId), "utf8");
    return parseProjectManifest(JSON.parse(file));
  } catch {
    return null;
  }
}

export async function listVisualProjectManifests(): Promise<VisualEngineProjectManifest[]> {
  try {
    const entries = await readdir(VISUAL_ENGINE_PROJECTS_ROOT, { withFileTypes: true });
    const projectIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const manifests = await Promise.all(projectIds.map((projectId) => readVisualProjectManifest(projectId)));

    return manifests.filter((manifest): manifest is VisualEngineProjectManifest => manifest !== null);
  } catch {
    return [];
  }
}

function isSupportedFile(fileName: string, extensions: Set<string>): boolean {
  return extensions.has(path.extname(fileName).toLowerCase());
}

function toProjectRelativePath(projectId: string, targetPath: string): string {
  return path.relative(getVisualProjectRoot(projectId), targetPath).replace(/\\/g, "/");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findFirstSupportedFile(
  folderPath: string,
  extensions: Set<string>,
  projectId: string,
): Promise<string | null> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const fileName = entries
      .filter((entry) => entry.isFile() && isSupportedFile(entry.name, extensions))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))[0];

    if (!fileName) {
      return null;
    }

    return toProjectRelativePath(projectId, path.join(folderPath, fileName));
  } catch {
    return null;
  }
}

async function resolvePreferredFile(
  projectId: string,
  preferredPaths: string[],
  fallbackFolder: string,
  extensions: Set<string>,
): Promise<string | null> {
  for (const preferredPath of preferredPaths) {
    if (await pathExists(resolveVisualProjectPath(projectId, preferredPath))) {
      return preferredPath;
    }
  }

  return findFirstSupportedFile(fallbackFolder, extensions, projectId);
}

export async function resolveVisualProjectMedia(projectId: string, project: VisualEngineProjectManifest) {
  const folders = getVisualProjectAssetFolders(projectId);

  return {
    audioFile: await resolvePreferredFile(
      projectId,
      project.audioFile ? [project.audioFile] : [],
      folders.audio,
      SUPPORTED_AUDIO_EXTENSIONS,
    ),
    imageFile: await resolvePreferredFile(projectId, project.imageFiles, folders.images, SUPPORTED_IMAGE_EXTENSIONS),
    lyricsFile: await resolvePreferredFile(
      projectId,
      project.lyricsFile ? [project.lyricsFile] : [],
      folders.lyrics,
      SUPPORTED_LYRICS_EXTENSIONS,
    ),
  };
}

export function relativeProjectPath(targetPath: string): string {
  return path.relative(process.cwd(), targetPath).replace(/\\/g, "/");
}
