import { readFile } from "node:fs/promises";
import path from "node:path";

import { ComfyClient, ComfyError } from "@/modules/comfy/client";

type ComfyGraphNode = {
  id: number;
  inputs?: Array<{ link?: number | null; name: string }>;
  type: string;
  widgets_values?: unknown[];
};

type ComfyGraph = {
  links?: Array<[number, number, number, number, number, string]>;
  nodes?: ComfyGraphNode[];
};

type WorkflowRegistryEntry = {
  negativeNodeId: string;
  positiveNodeId: string;
  requiredNodeTypes: string[];
  saveImageNodeId: string;
  workflowPath: string;
};

const WORKFLOW_REGISTRY = {
  "flux-fast-concept": {
    negativeNodeId: "36",
    positiveNodeId: "4",
    requiredNodeTypes: [
      "UNETLoader",
      "DualCLIPLoader",
      "CLIPTextEncodeFlux",
      "VAELoader",
      "EmptySD3LatentImage",
      "FluxGuidance",
      "KSampler",
      "VAEDecode",
      "SaveImage",
    ],
    saveImageNodeId: "9",
    workflowPath: path.join(process.cwd(), "src", "modules", "comfy", "workflows", "flux-fast-concept.json"),
  },
} satisfies Record<string, WorkflowRegistryEntry>;

const WIDGET_NAME_MAP: Record<string, string[]> = {
  CLIPTextEncodeFlux: ["clip_l", "t5xxl", "guidance"],
  DualCLIPLoader: ["clip_name1", "clip_name2", "type", "device"],
  EmptySD3LatentImage: ["width", "height", "batch_size"],
  FluxGuidance: ["guidance"],
  KSampler: ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
  SaveImage: ["filename_prefix"],
  UNETLoader: ["unet_name", "weight_dtype"],
  VAELoader: ["vae_name"],
};

export type SupportedComfyWorkflowType = keyof typeof WORKFLOW_REGISTRY;

export type QueuedComfyImageJob = {
  promptId: string;
  workflowPath: string;
  workflowType: SupportedComfyWorkflowType;
};

function getWorkflowEntry(workflowType: string): WorkflowRegistryEntry {
  const entry = WORKFLOW_REGISTRY[workflowType as SupportedComfyWorkflowType];

  if (!entry) {
    throw new ComfyError(`Unsupported Comfy workflow: ${workflowType}`, {
      code: "COMFY_MISSING_WORKFLOW",
      details: Object.keys(WORKFLOW_REGISTRY),
      statusCode: 400,
    });
  }

  return entry;
}

function cloneGraph(graph: ComfyGraph): ComfyGraph {
  return JSON.parse(JSON.stringify(graph)) as ComfyGraph;
}

async function loadWorkflowGraph(workflowType: SupportedComfyWorkflowType): Promise<{ entry: WorkflowRegistryEntry; graph: ComfyGraph }> {
  const entry = getWorkflowEntry(workflowType);

  try {
    const source = await readFile(entry.workflowPath, "utf8");
    const graph = JSON.parse(source) as ComfyGraph;

    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      throw new Error("Workflow graph is empty.");
    }

    return { entry, graph };
  } catch (error) {
    throw new ComfyError(
      `Comfy workflow file is missing or invalid: ${entry.workflowPath}`,
      {
        code: "COMFY_MISSING_WORKFLOW",
        details: [error instanceof Error ? error.message : "unknown workflow read failure"],
        statusCode: 500,
      },
    );
  }
}

function setNodeTextWidget(graph: ComfyGraph, nodeId: string, value: string): void {
  const node = graph.nodes?.find((candidate) => String(candidate.id) === nodeId);

  if (!node) {
    throw new ComfyError(`Comfy workflow is missing expected node ${nodeId}.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  if (!Array.isArray(node.widgets_values) || node.widgets_values.length === 0) {
    throw new ComfyError(`Comfy workflow node ${nodeId} has no editable widget values.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  node.widgets_values[0] = value;
}

function setSavePrefix(graph: ComfyGraph, nodeId: string, prefix: string): void {
  const node = graph.nodes?.find((candidate) => String(candidate.id) === nodeId);

  if (!node || !Array.isArray(node.widgets_values)) {
    throw new ComfyError(`Comfy workflow is missing SaveImage node ${nodeId}.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  node.widgets_values[0] = prefix;
}

function convertGraphToPrompt(graph: ComfyGraph): Record<string, unknown> {
  const prompt: Record<string, unknown> = {};
  const linksById = new Map<number, { sourceNodeId: string; sourceOutputIndex: number }>();

  for (const link of graph.links ?? []) {
    const [linkId, sourceNodeId, sourceOutputIndex] = link;
    linksById.set(linkId, { sourceNodeId: String(sourceNodeId), sourceOutputIndex });
  }

  for (const node of graph.nodes ?? []) {
    const inputs: Record<string, unknown> = {};

    for (const input of node.inputs ?? []) {
      if (typeof input.link !== "number") {
        continue;
      }

      const source = linksById.get(input.link);
      if (!source) {
        continue;
      }

      inputs[input.name] = [source.sourceNodeId, source.sourceOutputIndex];
    }

    const widgetNames = WIDGET_NAME_MAP[node.type] ?? [];
    for (const [index, widgetValue] of (node.widgets_values ?? []).entries()) {
      const widgetName = widgetNames[index];
      if (!widgetName) {
        continue;
      }

      inputs[widgetName] = widgetValue;
    }

    prompt[String(node.id)] = {
      class_type: node.type,
      inputs,
    };
  }

  return prompt;
}

export function listSupportedComfyWorkflowTypes(): SupportedComfyWorkflowType[] {
  return Object.keys(WORKFLOW_REGISTRY) as SupportedComfyWorkflowType[];
}

export function getComfyWorkflowPath(workflowType: SupportedComfyWorkflowType): string {
  return getWorkflowEntry(workflowType).workflowPath;
}

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
  const { entry, graph } = await loadWorkflowGraph(workflowType);
  const editableGraph = cloneGraph(graph);
  const outputPrefix = `${projectId}-concept-${Date.now()}`;

  setNodeTextWidget(editableGraph, entry.positiveNodeId, prompt);
  setNodeTextWidget(editableGraph, entry.negativeNodeId, negativePrompt);
  setSavePrefix(editableGraph, entry.saveImageNodeId, outputPrefix);

  await client.assertRequiredNodes(entry.requiredNodeTypes);

  const promptPayload = convertGraphToPrompt(editableGraph);
  const { promptId } = await client.submitPrompt({ prompt: promptPayload });

  return {
    promptId,
    workflowPath: entry.workflowPath,
    workflowType,
  };
}