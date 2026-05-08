import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readVisualProjectManifest, relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";
import type { VisualEnginePackageResult } from "@/modules/visual-engine/types";

export async function packageProject(
  projectId: string,
  renderedOutputPath: string,
): Promise<VisualEnginePackageResult> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw new Error("Visual Engine project was not found.");
  }

  const folders = getVisualProjectAssetFolders(projectId);
  const bundlePath = path.join(folders.packages, `${projectId}-bundle`);
  await mkdir(bundlePath, { recursive: true });

  const finalVideoPath = path.join(bundlePath, "final.mp4");
  const metadataPath = path.join(bundlePath, "metadata.json");
  await copyFile(renderedOutputPath, finalVideoPath);

  const metadata = {
    generatedAt: new Date().toISOString(),
    kind: project.kind,
    name: project.name,
    projectId,
    renderPath: relativeProjectPath(renderedOutputPath),
    status: project.status,
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    bundlePath: relativeProjectPath(bundlePath),
    files: [relativeProjectPath(finalVideoPath), relativeProjectPath(metadataPath)],
    metadataPath: relativeProjectPath(metadataPath),
    projectId,
  };
}
