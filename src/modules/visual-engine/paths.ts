import path from "node:path";

export const VISUAL_ENGINE_PROJECTS_ROOT = path.join(
  process.cwd(),
  "visual-workspace",
  "projects",
);

export function getVisualProjectRoot(projectId: string): string {
  return path.join(VISUAL_ENGINE_PROJECTS_ROOT, projectId);
}

export function getVisualProjectManifestPath(projectId: string): string {
  return path.join(getVisualProjectRoot(projectId), "project.json");
}

export function getVisualProjectAssetFolders(projectId: string): Record<string, string> {
  const root = getVisualProjectRoot(projectId);

  return {
    audio: path.join(root, "audio"),
    images: path.join(root, "images"),
    lyrics: path.join(root, "lyrics"),
    packages: path.join(root, "packages"),
    renders: path.join(root, "renders"),
    video: path.join(root, "video"),
  };
}
