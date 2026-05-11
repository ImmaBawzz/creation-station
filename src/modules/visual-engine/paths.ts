import path from "node:path";

export const VISUAL_WORKSPACE_PATH = path.resolve(
  process.env.VISUAL_WORKSPACE_PATH ?? path.join(process.cwd(), "visual-workspace"),
);

export const VISUAL_ENGINE_PROJECTS_ROOT = path.join(VISUAL_WORKSPACE_PATH, "projects");

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
    exports: path.join(root, "exports"),
    images: path.join(root, "images"),
    lyrics: path.join(root, "lyrics"),
    packages: path.join(root, "packages"),
    renders: path.join(root, "renders"),
    video: path.join(root, "video"),
  };
}

export function resolveVisualProjectPath(projectId: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (filePath.startsWith("visual-workspace/")) {
    return path.resolve(process.cwd(), filePath);
  }

  return path.resolve(getVisualProjectRoot(projectId), filePath);
}
