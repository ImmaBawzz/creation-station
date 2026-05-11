import { assembleFinalVideo } from "@/modules/final-assembly";
import type { VisualEngineRenderResult } from "@/modules/visual-engine/types";

export async function renderProject(projectId: string): Promise<VisualEngineRenderResult> {
  const result = await assembleFinalVideo(projectId);

  return {
    duration: result.duration,
    outputPath: result.outputPath,
    packagePath: result.packagePath,
    projectId: result.projectId,
    renderPath: result.renderPath,
    success: result.success,
    usedAudio: result.usedAudio,
    usedImage: result.usedImage,
  };
}
