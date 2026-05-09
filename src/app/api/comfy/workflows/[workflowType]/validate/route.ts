import { NextResponse } from "next/server";

import { ComfyClient, ComfyError } from "@/modules/comfy/client";
import {
  getComfyWorkflowEntry,
  readComfyWorkflowState,
  validateComfyWorkflow,
  writeComfyWorkflowState,
  type SupportedComfyWorkflowType,
} from "@/modules/comfy/workflows";
import { isSupportedComfyWorkflowType } from "@/modules/comfy/validate";

type RouteContext = {
  params: Promise<{ workflowType: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { workflowType } = await context.params;

  if (!isSupportedComfyWorkflowType(workflowType)) {
    return NextResponse.json({ error: "workflowType is missing or unsupported." }, { status: 400 });
  }

  const typedWorkflowType = workflowType as SupportedComfyWorkflowType;
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

    const previous = await readComfyWorkflowState(typedWorkflowType);
    const nextStatus = previous.status === "Validated" ? "Validated" : "Available";
    const state = await writeComfyWorkflowState({
      available: true,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: nextStatus === "Validated",
      status: nextStatus,
      valid: true,
      warnings: validation.warnings,
      workflowType: typedWorkflowType,
    });

    return NextResponse.json({
      ...validation,
      ...state,
      label: getComfyWorkflowEntry(typedWorkflowType).label,
    });
  } catch (error) {
    const routeError = error as ComfyError;
    const warnings = [...validation.warnings, routeError.message || "ComfyUI is offline."];
    const state = await writeComfyWorkflowState({
      available: false,
      errors: validation.errors,
      modelFiles: validation.modelFiles,
      nodeMapping: validation.nodeMapping,
      selectable: false,
      status: "Comfy offline",
      valid: true,
      warnings,
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
}