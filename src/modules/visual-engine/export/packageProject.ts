import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { readVisualProjectManifest, relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const execFileAsync = promisify(execFile);

function toPowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function createZipArchive(sourceDirectory: string, zipPath: string): Promise<void> {
  if (process.platform === "win32") {
    const command = [
      `$source = ${toPowerShellLiteral(sourceDirectory)}`,
      `$destination = ${toPowerShellLiteral(zipPath)}`,
      "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -Force",
    ].join("; ");

    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true,
    });
    return;
  }

  await execFileAsync("tar", ["-a", "-c", "-f", zipPath, "-C", sourceDirectory, "."], {
    windowsHide: true,
  });
}

export async function packageProject(
  projectId: string,
  renderedOutputPath: string,
  options?: {
    duration?: string;
    usedAudio?: string;
    usedImage?: string;
  },
) {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw new Error("Visual Engine project was not found.");
  }

  const folders = getVisualProjectAssetFolders(projectId);
  const stagingPath = path.join(folders.packages, `${projectId}-package`);
  const packagePath = path.join(folders.packages, `${projectId}.zip`);
  await rm(stagingPath, { force: true, recursive: true });
  await rm(packagePath, { force: true, recursive: false });
  await mkdir(stagingPath, { recursive: true });

  const finalVideoPath = path.join(stagingPath, "final.mp4");
  const metadataPath = path.join(stagingPath, "metadata.json");
  await copyFile(renderedOutputPath, finalVideoPath);

  const metadata = {
    duration: options?.duration ?? null,
    generatedAt: new Date().toISOString(),
    kind: project.kind,
    name: project.name,
    projectId,
    renderPath: relativeProjectPath(renderedOutputPath),
    status: project.status,
    usedAudio: options?.usedAudio ?? null,
    usedImage: options?.usedImage ?? null,
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await createZipArchive(stagingPath, packagePath);
  await rm(stagingPath, { force: true, recursive: true });

  return {
    files: ["final.mp4", "metadata.json"],
    metadataPath: "metadata.json",
    packagePath: relativeProjectPath(packagePath),
    projectId,
  };
}
