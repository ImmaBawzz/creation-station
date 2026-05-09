import { access } from "node:fs/promises";

import { ComfyClient } from "@/modules/comfy/client";
import { getComfyWorkflowPath, listSupportedComfyWorkflowTypes, type SupportedComfyWorkflowType } from "@/modules/comfy/queue";
import { readVisualProjectManifest } from "@/modules/visual-engine/manifest";

export async function validateComfyGenerationRequest({
  client,
  projectId,
  workflowType,
}: {
  client: ComfyClient;
  projectId: string;
  workflowType: SupportedComfyWorkflowType;
}): Promise<void> {
  const project = await readVisualProjectManifest(projectId);

  if (!project) {
    throw new Error("Visual Engine project was not found.");
  }

  const workflowPath = getComfyWorkflowPath(workflowType);

  try {
    await access(workflowPath);
  } catch {
    throw new Error(`Comfy workflow file is missing: ${workflowPath}`);
  }

  await client.checkAvailability();
}

export function isSupportedComfyWorkflowType(workflowType: string): workflowType is SupportedComfyWorkflowType {
  return listSupportedComfyWorkflowTypes().includes(workflowType as SupportedComfyWorkflowType);
}