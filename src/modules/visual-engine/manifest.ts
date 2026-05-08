import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  getVisualProjectManifestPath,
  VISUAL_ENGINE_PROJECTS_ROOT,
} from "@/modules/visual-engine/paths";
import type { VisualEngineProjectManifest } from "@/modules/visual-engine/types";

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

export function relativeProjectPath(targetPath: string): string {
  return path.relative(process.cwd(), targetPath).replace(/\\/g, "/");
}
