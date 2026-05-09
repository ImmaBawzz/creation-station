import type { FinalAssemblyScene, FinalAssemblyWarning } from "@/modules/final-assembly/types";

export function syncScenesToAudioDuration(
  scenes: FinalAssemblyScene[],
  audioDuration: number,
): { scenes: FinalAssemblyScene[]; warnings: FinalAssemblyWarning[] } {
  if (scenes.length === 0) {
    return { scenes: [], warnings: [] };
  }

  const warnings: FinalAssemblyWarning[] = [];
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.correctedDuration, 0);
  const delta = Number((audioDuration - totalDuration).toFixed(2));

  if (Math.abs(delta) < 0.05) {
    return { scenes, warnings };
  }

  const updatedScenes = [...scenes];
  const lastScene = updatedScenes[updatedScenes.length - 1];

  if (!lastScene) {
    return { scenes, warnings };
  }

  const correctedDuration = Number(Math.max(0.4, lastScene.correctedDuration + delta).toFixed(2));
  updatedScenes[updatedScenes.length - 1] = {
    ...lastScene,
    correctedDuration,
  };

  warnings.push({
    code: delta > 0 ? "audio-sync-extended-last-scene" : "audio-sync-trimmed-last-scene",
    message: delta > 0
      ? `Extended ${lastScene.sceneId} by ${delta.toFixed(2)}s to match master audio duration.`
      : `Trimmed ${lastScene.sceneId} by ${Math.abs(delta).toFixed(2)}s to match master audio duration.`,
    sceneId: lastScene.sceneId,
  });

  return { scenes: updatedScenes, warnings };
}