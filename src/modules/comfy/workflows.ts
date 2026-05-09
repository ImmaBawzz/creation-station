import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { ComfyError } from "@/modules/comfy/client";

export type ComfyGraphNode = {
  id: number;
  inputs?: Array<{ link?: number | null; name: string }>;
  type: string;
  widgets_values?: unknown[];
};

export type ComfyGraph = {
  links?: Array<[number, number, number, number, number, string]>;
  nodes?: ComfyGraphNode[];
};

export type WorkflowRegistryEntry = {
  filenamePrefix: string;
  label: string;
  modelRole: "concept" | "production";
  negativePromptNodeId: string;
  positivePromptNodeId: string;
  requiredNodeTypes: string[];
  samplerNodeId?: string;
  saveImageNodeId: string;
  smokeHeight: number;
  smokeSteps?: number;
  smokeWidth: number;
  widthHeightNodeId: string;
  workflowPath: string;
};

export type ComfyWorkflowValidationResult = {
  errors: string[];
  modelFiles: string[];
  nodeMapping: Record<string, string>;
  valid: boolean;
  warnings: string[];
  workflowType: SupportedComfyWorkflowType;
};

type WorkflowModelReference = {
  filename: string;
  searchDirectories: string[];
};

type ComfyWorkflowValidationOptions = {
  modelsRoot?: string | null;
  verifyModelFiles?: boolean;
};

export type ComfyWorkflowStatus =
  | "Available"
  | "Needs validation"
  | "Comfy offline"
  | "Timeout"
  | "Output missing"
  | "Validated";

export type ComfyWorkflowState = {
  available: boolean;
  errors: string[];
  modelFiles: string[];
  nodeMapping: Record<string, string>;
  selectable: boolean;
  status: ComfyWorkflowStatus;
  updatedAt: string;
  valid: boolean;
  warnings: string[];
  workflowType: SupportedComfyWorkflowType;
};

const DEBUG_ROOT = path.join(process.cwd(), ".debug");

const DEFAULT_WORKFLOW_STATE: Record<SupportedComfyWorkflowType, Pick<ComfyWorkflowState, "available" | "errors" | "modelFiles" | "nodeMapping" | "selectable" | "status" | "valid" | "warnings">> = {
  "flux-dev-cinematic": {
    available: false,
    errors: [],
    modelFiles: [],
    nodeMapping: {},
    selectable: false,
    status: "Needs validation",
    valid: false,
    warnings: [],
  },
  "flux-fast-concept": {
    available: true,
    errors: [],
    modelFiles: [],
    nodeMapping: {},
    selectable: true,
    status: "Validated",
    valid: true,
    warnings: [],
  },
};

const WORKFLOW_REGISTRY = {
  "flux-fast-concept": {
    filenamePrefix: "[projectId]-concept",
    label: "Fast Concept",
    modelRole: "concept",
    negativePromptNodeId: "36",
    positivePromptNodeId: "4",
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
    samplerNodeId: "7",
    saveImageNodeId: "9",
    smokeHeight: 512,
    smokeSteps: 6,
    smokeWidth: 512,
    widthHeightNodeId: "6",
    workflowPath: path.join(process.cwd(), "src", "modules", "comfy", "workflows", "flux-fast-concept.json"),
  },
  "flux-dev-cinematic": {
    filenamePrefix: "[projectId]-cinematic",
    label: "Cinematic Frame",
    modelRole: "production",
    negativePromptNodeId: "5",
    positivePromptNodeId: "4",
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
    samplerNodeId: "8",
    saveImageNodeId: "10",
    smokeHeight: 512,
    smokeSteps: 8,
    smokeWidth: 768,
    widthHeightNodeId: "7",
    workflowPath: path.join(process.cwd(), "src", "modules", "comfy", "workflows", "flux-dev-cinematic.json"),
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

const MODEL_SEARCH_DIRECTORIES = {
  clip: ["clip", "text_encoders"],
  unet: ["unet", "diffusion_models", "checkpoints"],
  vae: ["vae"],
} as const;

let cachedComfyModelsRoot: Promise<string | null> | null = null;

export type SupportedComfyWorkflowType = keyof typeof WORKFLOW_REGISTRY;

function getValidationDebugPath(workflowType: SupportedComfyWorkflowType): string {
  return path.join(DEBUG_ROOT, `comfy-workflow-validation-${workflowType}.json`);
}

function getWorkflowStatePath(workflowType: SupportedComfyWorkflowType): string {
  return path.join(DEBUG_ROOT, `comfy-workflow-state-${workflowType}.json`);
}

async function writeValidationDebug(
  workflowType: SupportedComfyWorkflowType,
  payload: ComfyWorkflowValidationResult,
): Promise<void> {
  await mkdir(DEBUG_ROOT, { recursive: true });
  await writeFile(getValidationDebugPath(workflowType), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function readComfyWorkflowState(workflowType: SupportedComfyWorkflowType): Promise<ComfyWorkflowState> {
  try {
    const source = await readFile(getWorkflowStatePath(workflowType), "utf8");
    return JSON.parse(source) as ComfyWorkflowState;
  } catch {
    return {
      ...DEFAULT_WORKFLOW_STATE[workflowType],
      updatedAt: new Date(0).toISOString(),
      workflowType,
    };
  }
}

export async function writeComfyWorkflowState(
  state: Omit<ComfyWorkflowState, "updatedAt">,
): Promise<ComfyWorkflowState> {
  const nextState: ComfyWorkflowState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(DEBUG_ROOT, { recursive: true });
  await writeFile(getWorkflowStatePath(state.workflowType), `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  return nextState;
}

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

export async function loadWorkflowGraph(
  workflowType: SupportedComfyWorkflowType,
): Promise<{ entry: WorkflowRegistryEntry; graph: ComfyGraph }> {
  const entry = getWorkflowEntry(workflowType);

  try {
    const source = await readFile(entry.workflowPath, "utf8");
    const graph = JSON.parse(source) as ComfyGraph;

    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      throw new Error("Workflow graph is empty.");
    }

    return { entry, graph };
  } catch (error) {
    throw new ComfyError(`Comfy workflow file is missing or invalid: ${entry.workflowPath}`, {
      code: "COMFY_MISSING_WORKFLOW",
      details: [error instanceof Error ? error.message : "unknown workflow read failure"],
      statusCode: 500,
    });
  }
}

function findNode(graph: ComfyGraph, nodeId: string): ComfyGraphNode | undefined {
  return graph.nodes?.find((candidate) => String(candidate.id) === nodeId);
}

function ensureEditableTextNode(graph: ComfyGraph, nodeId: string, label: string): ComfyGraphNode {
  const node = findNode(graph, nodeId);

  if (!node) {
    throw new ComfyError(`Comfy workflow is missing ${label} node ${nodeId}.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  if (!Array.isArray(node.widgets_values) || node.widgets_values.length === 0 || typeof node.widgets_values[0] !== "string") {
    throw new ComfyError(`Comfy workflow ${label} node ${nodeId} has no editable text widget.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  return node;
}

function ensureEditableSaveNode(graph: ComfyGraph, nodeId: string): ComfyGraphNode {
  const node = findNode(graph, nodeId);

  if (!node) {
    throw new ComfyError(`Comfy workflow is missing SaveImage node ${nodeId}.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  if (!Array.isArray(node.widgets_values) || node.widgets_values.length === 0 || typeof node.widgets_values[0] !== "string") {
    throw new ComfyError(`Comfy workflow SaveImage node ${nodeId} has no editable filename prefix widget.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  return node;
}

function ensureWidthHeightNode(graph: ComfyGraph, nodeId: string): ComfyGraphNode {
  const node = findNode(graph, nodeId);

  if (!node) {
    throw new ComfyError(`Comfy workflow is missing latent width/height node ${nodeId}.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  if (
    !Array.isArray(node.widgets_values) ||
    node.widgets_values.length < 2 ||
    typeof node.widgets_values[0] !== "number" ||
    typeof node.widgets_values[1] !== "number"
  ) {
    throw new ComfyError(`Comfy workflow latent width/height node ${nodeId} is not mutable.`, {
      code: "COMFY_INVALID_WORKFLOW",
      statusCode: 500,
    });
  }

  return node;
}

function resolveFilenamePrefix(template: string, projectId: string): string {
  return template.replaceAll("[projectId]", projectId);
}

function setNodeText(node: ComfyGraphNode, value: string): void {
  if (!Array.isArray(node.widgets_values)) {
    return;
  }

  node.widgets_values[0] = value;
}

function setWidthHeight(node: ComfyGraphNode, width: number, height: number): void {
  if (!Array.isArray(node.widgets_values) || node.widgets_values.length < 2) {
    return;
  }

  node.widgets_values[0] = width;
  node.widgets_values[1] = height;
}

function setSamplerSteps(graph: ComfyGraph, nodeId: string | undefined, steps: number | undefined): void {
  if (!nodeId || typeof steps !== "number") {
    return;
  }

  const node = findNode(graph, nodeId);
  if (!node || !Array.isArray(node.widgets_values) || node.widgets_values.length < 3) {
    return;
  }

  node.widgets_values[2] = steps;
}

function collectModelFiles(graph: ComfyGraph): string[] {
  const files = new Set<string>();

  for (const node of graph.nodes ?? []) {
    if (!Array.isArray(node.widgets_values)) {
      continue;
    }

    if (node.type === "UNETLoader" && typeof node.widgets_values[0] === "string" && node.widgets_values[0]) {
      files.add(node.widgets_values[0]);
    }

    if (node.type === "VAELoader" && typeof node.widgets_values[0] === "string" && node.widgets_values[0]) {
      files.add(node.widgets_values[0]);
    }

    if (node.type === "DualCLIPLoader") {
      for (const index of [0, 1]) {
        const value = node.widgets_values[index];
        if (typeof value === "string" && value) {
          files.add(value);
        }
      }
    }
  }

  return [...files];
}

function collectWorkflowModelReferences(graph: ComfyGraph): WorkflowModelReference[] {
  const references = new Map<string, WorkflowModelReference>();

  for (const node of graph.nodes ?? []) {
    if (!Array.isArray(node.widgets_values)) {
      continue;
    }

    if (node.type === "UNETLoader" && typeof node.widgets_values[0] === "string" && node.widgets_values[0]) {
      references.set(`unet:${node.widgets_values[0]}`, {
        filename: node.widgets_values[0],
        searchDirectories: [...MODEL_SEARCH_DIRECTORIES.unet],
      });
    }

    if (node.type === "VAELoader" && typeof node.widgets_values[0] === "string" && node.widgets_values[0]) {
      references.set(`vae:${node.widgets_values[0]}`, {
        filename: node.widgets_values[0],
        searchDirectories: [...MODEL_SEARCH_DIRECTORIES.vae],
      });
    }

    if (node.type === "DualCLIPLoader") {
      for (const index of [0, 1]) {
        const value = node.widgets_values[index];
        if (typeof value === "string" && value) {
          references.set(`clip:${value}`, {
            filename: value,
            searchDirectories: [...MODEL_SEARCH_DIRECTORIES.clip],
          });
        }
      }
    }
  }

  return [...references.values()];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveComfyModelsRoot(explicitModelsRoot?: string | null): Promise<string | null> {
  if (typeof explicitModelsRoot !== "undefined") {
    return explicitModelsRoot;
  }

  if (!cachedComfyModelsRoot) {
    cachedComfyModelsRoot = (async () => {
      const configuredModelsDir = process.env.CREATION_STATION_COMFYUI_MODELS_DIR ?? process.env.COMFYUI_MODELS_DIR;
      if (configuredModelsDir && await pathExists(configuredModelsDir)) {
        return configuredModelsDir;
      }

      const configuredRoot = process.env.CREATION_STATION_COMFYUI_ROOT ?? process.env.COMFYUI_ROOT;
      if (configuredRoot) {
        const modelsDir = path.join(configuredRoot, "models");
        if (await pathExists(modelsDir)) {
          return modelsDir;
        }
      }

      const home = homedir();
      const candidates = [
        path.join(home, "Documents", "ComfyUI", "models"),
        path.join(home, "ComfyUI", "models"),
        path.join(home, "Downloads", "ComfyUI_windows_portable", "ComfyUI", "models"),
        path.join("C:", "ComfyUI", "models"),
      ];

      for (const candidate of candidates) {
        if (await pathExists(candidate)) {
          return candidate;
        }
      }

      return null;
    })();
  }

  return cachedComfyModelsRoot;
}

async function findMissingModelFiles(
  references: WorkflowModelReference[],
  modelsRoot: string,
): Promise<string[]> {
  const missingFiles: string[] = [];

  for (const reference of references) {
    let found = false;

    for (const relativeDirectory of reference.searchDirectories) {
      const candidatePath = path.join(modelsRoot, relativeDirectory, reference.filename);
      if (await pathExists(candidatePath)) {
        found = true;
        break;
      }
    }

    if (!found) {
      missingFiles.push(reference.filename);
    }
  }

  return missingFiles;
}

export async function validateComfyWorkflow(
  workflowType: SupportedComfyWorkflowType,
  options: ComfyWorkflowValidationOptions = {},
): Promise<ComfyWorkflowValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeMapping: Record<string, string> = {};

  try {
    const { entry, graph } = await loadWorkflowGraph(workflowType);
    const positiveNode = findNode(graph, entry.positivePromptNodeId);
    const negativeNode = findNode(graph, entry.negativePromptNodeId);
    const saveNode = findNode(graph, entry.saveImageNodeId);
    const widthHeightNode = findNode(graph, entry.widthHeightNodeId);
    const modelFiles = collectModelFiles(graph);
    const modelReferences = collectWorkflowModelReferences(graph);

    nodeMapping.positivePromptNodeId = entry.positivePromptNodeId;
    nodeMapping.negativePromptNodeId = entry.negativePromptNodeId;
    nodeMapping.saveImageNodeId = entry.saveImageNodeId;
    nodeMapping.widthHeightNodeId = entry.widthHeightNodeId;

    if (!positiveNode) {
      errors.push(`Missing positive prompt node: ${entry.positivePromptNodeId}`);
    } else if (!Array.isArray(positiveNode.widgets_values) || positiveNode.widgets_values.length === 0 || typeof positiveNode.widgets_values[0] !== "string") {
      errors.push(`Positive prompt node is not mutable: ${entry.positivePromptNodeId}`);
    }

    if (!negativeNode) {
      errors.push(`Missing negative prompt node: ${entry.negativePromptNodeId}`);
    } else if (!Array.isArray(negativeNode.widgets_values) || negativeNode.widgets_values.length === 0 || typeof negativeNode.widgets_values[0] !== "string") {
      errors.push(`Negative prompt node is not mutable: ${entry.negativePromptNodeId}`);
    }

    if (!saveNode) {
      errors.push(`Missing SaveImage node: ${entry.saveImageNodeId}`);
    } else if (!Array.isArray(saveNode.widgets_values) || saveNode.widgets_values.length === 0 || typeof saveNode.widgets_values[0] !== "string") {
      errors.push(`SaveImage node is not mutable: ${entry.saveImageNodeId}`);
    }

    if (!widthHeightNode) {
      errors.push(`Missing latent width/height node: ${entry.widthHeightNodeId}`);
    } else if (
      !Array.isArray(widthHeightNode.widgets_values) ||
      widthHeightNode.widgets_values.length < 2 ||
      typeof widthHeightNode.widgets_values[0] !== "number" ||
      typeof widthHeightNode.widgets_values[1] !== "number"
    ) {
      errors.push(`Latent width/height node is not mutable: ${entry.widthHeightNodeId}`);
    }

    if (!modelFiles.some((file) => file.includes(".safetensors") && file.toLowerCase().includes("flux"))) {
      errors.push("Missing model filename in workflow.");
    }

    if (!modelFiles.some((file) => file.toLowerCase().includes("ae") && file.endsWith(".safetensors"))) {
      errors.push("Missing VAE filename in workflow.");
    }

    const clipFiles = modelFiles.filter((file) => file.endsWith(".safetensors") && (file.toLowerCase().includes("clip") || file.toLowerCase().includes("t5")));
    if (clipFiles.length < 2) {
      errors.push("Missing CLIP filenames in workflow.");
    }

    const shouldVerifyModelFiles = options.verifyModelFiles ?? entry.modelRole === "production";

    if (shouldVerifyModelFiles) {
      const modelsRoot = await resolveComfyModelsRoot(options.modelsRoot);

      if (modelsRoot) {
        const missingModelFiles = await findMissingModelFiles(modelReferences, modelsRoot);
        for (const missingFile of missingModelFiles) {
          errors.push(`Missing model file: ${missingFile}`);
        }
      } else {
        warnings.push(
          "Comfy model root could not be resolved. Set CREATION_STATION_COMFYUI_MODELS_DIR or CREATION_STATION_COMFYUI_ROOT to enable exact model-file validation.",
        );
      }
    }

    for (const nodeType of entry.requiredNodeTypes) {
      if (!(graph.nodes ?? []).some((node) => node.type === nodeType)) {
        warnings.push(`Workflow graph is missing expected node type ${nodeType}.`);
      }
    }

    const result: ComfyWorkflowValidationResult = {
      errors,
      modelFiles,
      nodeMapping,
      valid: errors.length === 0,
      warnings,
      workflowType,
    };

    if (!result.valid) {
      await writeValidationDebug(workflowType, result);
    }

    return result;
  } catch (error) {
    const result: ComfyWorkflowValidationResult = {
      errors: [error instanceof Error ? error.message : "Workflow validation failed."],
      modelFiles: [],
      nodeMapping,
      valid: false,
      warnings,
      workflowType,
    };

    await writeValidationDebug(workflowType, result);
    return result;
  }
}

export function buildComfyPromptPayload(graph: ComfyGraph): Record<string, unknown> {
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

export async function prepareComfyWorkflowPrompt({
  negativePrompt,
  projectId,
  prompt,
  smokeTest = false,
  workflowType,
}: {
  negativePrompt: string;
  projectId: string;
  prompt: string;
  smokeTest?: boolean;
  workflowType: SupportedComfyWorkflowType;
}): Promise<{ entry: WorkflowRegistryEntry; graph: ComfyGraph; outputPrefix: string; promptPayload: Record<string, unknown> }> {
  const { entry, graph } = await loadWorkflowGraph(workflowType);
  const editableGraph = cloneGraph(graph);
  const outputPrefixBase = resolveFilenamePrefix(entry.filenamePrefix, projectId);
  const outputPrefix = `${outputPrefixBase}-${Date.now()}`;

  const positiveNode = ensureEditableTextNode(editableGraph, entry.positivePromptNodeId, "positive prompt");
  const negativeNode = ensureEditableTextNode(editableGraph, entry.negativePromptNodeId, "negative prompt");
  const saveNode = ensureEditableSaveNode(editableGraph, entry.saveImageNodeId);

  setNodeText(positiveNode, prompt);
  setNodeText(negativeNode, negativePrompt);
  setNodeText(saveNode, outputPrefix);

  if (smokeTest) {
    const sizeNode = ensureWidthHeightNode(editableGraph, entry.widthHeightNodeId);
    setWidthHeight(sizeNode, entry.smokeWidth, entry.smokeHeight);
    setSamplerSteps(editableGraph, entry.samplerNodeId, entry.smokeSteps);
  }

  return {
    entry,
    graph: editableGraph,
    outputPrefix,
    promptPayload: buildComfyPromptPayload(editableGraph),
  };
}

export function listSupportedComfyWorkflowTypes(): SupportedComfyWorkflowType[] {
  return Object.keys(WORKFLOW_REGISTRY) as SupportedComfyWorkflowType[];
}

export function getComfyWorkflowPath(workflowType: SupportedComfyWorkflowType): string {
  return getWorkflowEntry(workflowType).workflowPath;
}

export function getComfyWorkflowEntry(workflowType: SupportedComfyWorkflowType): WorkflowRegistryEntry {
  return getWorkflowEntry(workflowType);
}