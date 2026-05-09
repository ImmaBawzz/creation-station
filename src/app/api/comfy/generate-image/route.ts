import { NextResponse } from "next/server";

import { ComfyClient, resolveComfyTimeoutMs } from "@/modules/comfy/client";
import { createComfyJob } from "@/modules/comfy/jobs";
import { queueComfyImageJob, type SupportedComfyWorkflowType } from "@/modules/comfy/queue";
import { isSupportedComfyWorkflowType, validateComfyGenerationRequest } from "@/modules/comfy/validate";

type ComfyGenerateRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const projectId = asString(payload.projectId);
    const prompt = asString(payload.prompt);
    const negativePrompt = asString(payload.negativePrompt);
    const workflowType = asString(payload.workflowType);

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required." }, { status: 400 });
    }

    if (!workflowType || !isSupportedComfyWorkflowType(workflowType)) {
      return NextResponse.json({ error: "workflowType is missing or unsupported." }, { status: 400 });
    }

    const client = new ComfyClient();

    try {
      await validateComfyGenerationRequest({
        client,
        projectId,
        workflowType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comfy validation failed.";
      const status = message.includes("not found") ? 404 : message.includes("missing") ? 500 : 503;
      return NextResponse.json({ error: message, projectId }, { status });
    }

    const job = await queueComfyImageJob({
      client,
      negativePrompt,
      projectId,
      prompt,
      workflowType: workflowType as SupportedComfyWorkflowType,
    });

    const trackedJob = await createComfyJob({
      projectId,
      promptId: job.promptId,
      timeoutMs: resolveComfyTimeoutMs(),
      workflowType: job.workflowType,
    });

    return NextResponse.json({
      jobId: trackedJob.jobId,
      promptId: job.promptId,
      status: trackedJob.status,
      success: true,
    });
  } catch (error) {
    const comfyError = error as ComfyGenerateRouteError;

    return NextResponse.json(
      {
        details: comfyError.details ?? [],
        error: comfyError.message || "Comfy image generation failed.",
      },
      { status: comfyError.statusCode ?? 500 },
    );
  }
}