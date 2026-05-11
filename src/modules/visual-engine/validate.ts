import { access } from "node:fs/promises";

import { readVisualProjectManifest, resolveVisualProjectMedia } from "@/modules/visual-engine/manifest";
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

  if (project.imageFiles.length === 0 && project.videoFiles.length === 0) {
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

  const resolvedMedia = await resolveVisualProjectMedia(projectId, project);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resolvedMedia.audioFile) {
    errors.push("Missing audio file");
  }

  if (!resolvedMedia.imageFile) {
    errors.push("Missing image files");
  }

  if (project.audioFile && resolvedMedia.audioFile !== project.audioFile) {
    warnings.push(`Manifest audio file was skipped because it does not exist: ${project.audioFile}`);
  }

  if (project.lyricsFile && !await fileExists(projectId, project.lyricsFile)) {
    warnings.push(`Lyrics file path does not exist: ${project.lyricsFile}`);
  }

  for (const imageFile of project.imageFiles) {
    if (imageFile !== resolvedMedia.imageFile && !await fileExists(projectId, imageFile)) {
      warnings.push(`Image file path does not exist: ${imageFile}`);
    }
  }

  for (const videoFile of project.videoFiles) {
    if (!await fileExists(projectId, videoFile)) {
      warnings.push(`Video file path does not exist: ${videoFile}`);
    }
  }

  return {
    errors,
    projectId,
    valid: errors.length === 0,
    warnings,
  };
}

