import { access } from "node:fs/promises";

import { readVisualProjectManifest } from "@/modules/visual-engine/manifest";
import { getVisualProjectRoot } from "@/modules/visual-engine/paths";
import type {
  VisualEngineProjectManifest,
  VisualEngineProjectValidationResult,
} from "@/modules/visual-engine/types";

async function fileExists(root: string, relativePath: string | null): Promise<boolean> {
  if (!relativePath) {
    return false;
  }

  try {
    await access(relativePath.startsWith("visual-workspace/") ? `${process.cwd()}/${relativePath}` : `${root}/${relativePath}`);
    return true;
  } catch {
    return false;
  }
}

export function validateVisualProjectManifest(
  project: VisualEngineProjectManifest,
): VisualEngineProjectValidationResult {
  const errors: string[] = [];

  if (!project.audioFile) {
    errors.push("Missing audio file");
  }

  if (!project.lyricsFile) {
    errors.push("Missing lyrics file");
  }

  if (project.imageFiles.length === 0) {
    errors.push("Missing image files");
  }

  return {
    errors,
    projectId: project.id,
    valid: errors.length === 0,
    warnings: [],
  };
}

export async function validateVisualProjectById(
  projectId: string,
): Promise<VisualEngineProjectValidationResult | null> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    return null;
  }

  const result = validateVisualProjectManifest(project);
  const projectRoot = getVisualProjectRoot(projectId);

  if (project.audioFile && !await fileExists(projectRoot, project.audioFile)) {
    result.errors.push("Audio file path does not exist");
  }

  if (project.lyricsFile && !await fileExists(projectRoot, project.lyricsFile)) {
    result.errors.push("Lyrics file path does not exist");
  }

  result.valid = result.errors.length === 0;

  return result;
}
