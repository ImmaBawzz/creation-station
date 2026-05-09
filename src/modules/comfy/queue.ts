import { ComfyClient, ComfyError } from "@/modules/comfy/client";
import {
  getComfyWorkflowEntry,
  getComfyWorkflowPath,
  listSupportedComfyWorkflowTypes,
  prepareComfyWorkflowPrompt,
  type SupportedComfyWorkflowType,
} from "@/modules/comfy/workflows";

export type { SupportedComfyWorkflowType } from "@/modules/comfy/workflows";

export type QueuedComfyImageJob = {
  promptId: string;
  workflowPath: string;
  workflowType: SupportedComfyWorkflowType;
};

export async function queueComfyImageJob({
  client,
  negativePrompt,
  projectId,
  prompt,
  workflowType,
}: {
  client: ComfyClient;
  negativePrompt: string;
  projectId: string;
  prompt: string;
  workflowType: SupportedComfyWorkflowType;
}): Promise<QueuedComfyImageJob> {
  const { entry, outputPrefix, promptPayload } = await prepareComfyWorkflowPrompt({
    negativePrompt,
    projectId,
    prompt,
    workflowType,
  });

  await client.assertRequiredNodes(entry.requiredNodeTypes);
  const { promptId } = await client.submitPrompt({ prompt: promptPayload });

  return {
    promptId,
    workflowPath: getComfyWorkflowPath(workflowType),
    workflowType,
  };
}