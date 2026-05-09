import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ComfyClient, ComfyError, type ComfyOutputRef } from "@/modules/comfy/client";
import { getVisualProjectAssetFolders, getVisualProjectManifestPath } from "@/modules/visual-engine/paths";
import type { VisualEngineProjectManifest } from "@/modules/visual-engine/types";

function sanitizeBaseName(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "concept-art";
}

function normalizeImagePath(fileName: string): string {
  return path.posix.join("images", fileName);
}

async function readManifest(projectId: string): Promise<VisualEngineProjectManifest> {
  const manifestPath = getVisualProjectManifestPath(projectId);
  const source = await readFile(manifestPath, "utf8");
  return JSON.parse(source) as VisualEngineProjectManifest;
}

export async function importComfyOutputToProject({
  client,
  output,
  projectId,
}: {
  client: ComfyClient;
  output: ComfyOutputRef;
  projectId: string;
}): Promise<{ imagePath: string; manifestPath: string }> {
  const manifestPath = getVisualProjectManifestPath(projectId);
  const folders = getVisualProjectAssetFolders(projectId);
  const extension = path.extname(output.filename).toLowerCase() || ".png";
  const fileName = `${sanitizeBaseName(output.filename)}${extension}`;
  const targetPath = path.join(folders.images, fileName);
  const relativeImagePath = normalizeImagePath(fileName);
  const bytes = await client.downloadOutput(output);

  if (bytes.length === 0) {
    throw new ComfyError(`ComfyUI output is empty or corrupted: ${output.filename}`, {
      code: "COMFY_EMPTY_OUTPUT",
      statusCode: 502,
    });
  }

  await mkdir(folders.images, { recursive: true });
  await writeFile(targetPath, bytes);

  const manifest = await readManifest(projectId);
  const nextImageFiles = manifest.imageFiles.includes(relativeImagePath)
    ? manifest.imageFiles
    : [relativeImagePath, ...manifest.imageFiles];

  const nextManifest: VisualEngineProjectManifest = {
    ...manifest,
    imageFiles: nextImageFiles,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");

  return {
    imagePath: relativeImagePath,
    manifestPath,
  };
}