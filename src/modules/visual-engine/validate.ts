import { access } from "node:fs/promises";

import { readVisualProjectManifest } from "@/modules/visual-engine/manifest";
import { resolveVisualProjectPath } from "@/modules/visual-engine/paths";
import type {
  VisualEngineProjectManifest,
  VisualEngineProjectValidationResult,
} from "@/modules/visual-engine/types";

async function fileExists(projectId: string, relativePath: string | null): Promise<boolean> {
  if (!relativePath) {
    return false;
  }

  try {
    await access(resolveVisualProjectPath(projectId, relativePath));
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

  if (project.audioFile && !await fileExists(projectId, project.audioFile)) {
    result.errors.push("Audio file path does not exist");
  }

  if (project.lyricsFile && !await fileExists(projectId, project.lyricsFile)) {
    result.errors.push("Lyrics file path does not exist");
  }

  for (const imageFile of project.imageFiles) {
    if (!await fileExists(projectId, imageFile)) {
      result.errors.push(`Image file path does not exist: ${imageFile}`);
    }
  }

  for (const videoFile of project.videoFiles) {
    if (!await fileExists(projectId, videoFile)) {
      result.warnings.push(`Video file path does not exist: ${videoFile}`);
    }
  }

  result.valid = result.errors.length === 0;

  return result;
}

