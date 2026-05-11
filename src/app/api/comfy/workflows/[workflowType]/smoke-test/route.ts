import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ComfyClient, ComfyError } from "@/modules/comfy/client";
import { importComfyOutputToProject } from "@/modules/comfy/importOutput";
import {
  getComfyWorkflowEntry,
  prepareComfyWorkflowPrompt,
  validateComfyWorkflow,
  writeComfyWorkflowState,
  type SupportedComfyWorkflowType,
} from "@/modules/comfy/workflows";
import { isSupportedComfyWorkflowType } from "@/modules/comfy/validate";
import { readVisualProjectManifest, relativeProjectPath } from "@/modules/visual-engine/manifest";

const DEBUG_ROOT = path.join(process.cwd(), ".debug");
const SAFE_SMOKE_PROMPT = "cinematic still frame, neutral composition, soft dramatic lighting, no text";
const SAFE_SMOKE_NEGATIVE_PROMPT = "blurry, low quality, watermark, text, logo, distorted anatomy";

type RouteContext = {
  params: Promise<{ workflowType: string }>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function writeHistoryDebug(promptId: string, history: Record<string, unknown>): Promise<void> {
  await mkdir(DEBUG_ROOT, { recursive: true });
  await writeFile(path.join(DEBUG_ROOT, `comfy-history-${promptId}.json`), `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

export async function POST(request: Request, context: RouteContext) {
  const { workflowType } = await context.params;

  if (!isSupportedComfyWorkflowType(workflowType)) {
    return NextResponse.json({ error: "workflowType is missing or unsupported." }, { status: 400 });
  }

  const typedWorkflowType = workflowType as SupportedComfyWorkflowType;
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = asString(payload.projectId);

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const project = await readVisualProjectManifest(projectId);
  if (!project) {
    return NextResponse.json({ error: "Visual Engine project was not found." }, { status: 404 });
  }

  const validation = await validateComfyWorkflow(typedWorkflowType);
  if (!validation.valid) {
    const state = await writeComfyWorkflowState({
      available: false,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: false,
      status: "Needs validation",
      valid: false,
      warnings: validation.warnings,
      workflowType: typedWorkflowType,
    });

    return NextResponse.json({ ...validation, ...state }, { status: 422 });
  }

  const client = new ComfyClient();

  try {
    await client.checkAvailability();
  } catch (error) {
    const routeError = error as ComfyError;
    const state = await writeComfyWorkflowState({
      available: false,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: false,
      status: "Comfy offline",
      valid: true,
      warnings: [...validation.warnings, routeError.message || "ComfyUI is offline."],
      workflowType: typedWorkflowType,
    });

    return NextResponse.json(
      {
        ...validation,
        ...state,
        label: getComfyWorkflowEntry(typedWorkflowType).label,
      },
      { status: routeError.statusCode ?? 503 },
    );
  }

  const { entry, outputPrefix, promptPayload } = await prepareComfyWorkflowPrompt({
    negativePrompt: SAFE_SMOKE_NEGATIVE_PROMPT,
    projectId,
    prompt: SAFE_SMOKE_PROMPT,
    smokeTest: true,
    workflowType: typedWorkflowType,
  });

  await client.assertRequiredNodes(entry.requiredNodeTypes);

  const { promptId } = await client.submitPrompt({ prompt: promptPayload });

  try {
    await client.waitForCompletion({ promptId });
  } catch (error) {
    const routeError = error as ComfyError;

    if (routeError.code === "COMFY_TIMEOUT") {
      const state = await writeComfyWorkflowState({
        available: true,
        errors: validation.errors,
        modelFiles: validation.modelFiles,
        nodeMapping: validation.nodeMapping,
        selectable: false,
        status: "Timeout",
        valid: true,
        warnings: [
          ...validation.warnings,
          "Smoke test timed out. Increase CREATION_STATION_COMFY_TIMEOUT_MS if this workflow is expected to run longer.",
        ],
        workflowType: typedWorkflowType,
      });

      return NextResponse.json(
        {
          ...validation,
          ...state,
          label: getComfyWorkflowEntry(typedWorkflowType).label,
          promptId,
          projectId,
          statusMessage: "Increase CREATION_STATION_COMFY_TIMEOUT_MS to allow longer smoke tests.",
        },
        { status: 504 },
      );
    }

    throw error;
  }

  let outputs;
  try {
    outputs = await client.retrieveOutputs(promptId);
  } catch (error) {
    const history = await client.getHistory(promptId).catch(() => ({}));
    await writeHistoryDebug(promptId, history);

    const routeError = error as ComfyError;
    const state = await writeComfyWorkflowState({
      available: true,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: false,
      status: "Output missing",
      valid: true,
      warnings: [...validation.warnings, routeError.message || "ComfyUI completed without retrievable output."],
      workflowType: typedWorkflowType,
    });

    return NextResponse.json(
      {
        ...validation,
        ...state,
        historyPath: relativeProjectPath(path.join(DEBUG_ROOT, `comfy-history-${promptId}.json`)),
        label: getComfyWorkflowEntry(typedWorkflowType).label,
        promptId,
        projectId,
      },
      { status: routeError.statusCode ?? 502 },
    );
  }

  const [firstOutput] = outputs;
  if (!firstOutput) {
    const history = await client.getHistory(promptId).catch(() => ({}));
    await writeHistoryDebug(promptId, history);

    const state = await writeComfyWorkflowState({
      available: true,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: false,
      status: "Output missing",
      valid: true,
      warnings: [...validation.warnings, "ComfyUI completed but returned no output files."],
      workflowType: typedWorkflowType,
    });

    return NextResponse.json(
      {
        ...validation,
        ...state,
        historyPath: relativeProjectPath(path.join(DEBUG_ROOT, `comfy-history-${promptId}.json`)),
        label: getComfyWorkflowEntry(typedWorkflowType).label,
        promptId,
        projectId,
      },
      { status: 502 },
    );
  }

  const imported = await importComfyOutputToProject({
    client,
    output: firstOutput,
    projectId,
  });

  const state = await writeComfyWorkflowState({
    available: true,
    errors: validation.errors,
    modelFiles: validation.modelFiles,
    nodeMapping: validation.nodeMapping,
    selectable: true,
    status: "Validated",
    valid: true,
    warnings: validation.warnings,
    workflowType: typedWorkflowType,
  });

  return NextResponse.json({
    ...validation,
    ...state,
    label: getComfyWorkflowEntry(typedWorkflowType).label,
    manifestPath: relativeProjectPath(imported.manifestPath),
    outputPath: imported.imagePath,
    outputPrefix,
    projectId,
    promptId,
  });
}