import { access } from "node:fs/promises";

import type { FinalAssemblyState } from "@/modules/final-assembly/types";
import { resolveVisualProjectPath } from "@/modules/visual-engine/paths";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function recoverRetryState(state: FinalAssemblyState): Promise<FinalAssemblyState> {
  const assembledVideoPath = state.artifacts.assembledVideoPath
    ? resolveVisualProjectPath(state.projectId, state.artifacts.assembledVideoPath)
    : null;
  const hasAssembledVideo = assembledVideoPath ? await pathExists(assembledVideoPath) : false;
  const subtitleArtifacts = await Promise.all(state.artifacts.subtitleArtifacts.map(async (artifact) => ({
    ...artifact,
    exists: await pathExists(resolveVisualProjectPath(state.projectId, artifact.outputPath)),
  })));
  const exportArtifacts = await Promise.all(state.artifacts.exportArtifacts.map(async (artifact) => ({
    ...artifact,
    exists: await pathExists(resolveVisualProjectPath(state.projectId, artifact.relativePath)),
  })));

  return {
    ...state,
    artifacts: {
      ...state.artifacts,
      exportArtifacts: exportArtifacts.filter((artifact) => artifact.exists).map(({ exists: _exists, ...artifact }) => artifact),
      subtitleArtifacts: subtitleArtifacts.filter((artifact) => artifact.exists).map(({ exists: _exists, ...artifact }) => artifact),
    },
    currentStage: hasAssembledVideo
      ? exportArtifacts.some((artifact) => !artifact.exists)
        ? "export-profiles"
        : "render-master"
      : subtitleArtifacts.length > 0
      ? "render-master"
      : "scene-assembly",
  };
}