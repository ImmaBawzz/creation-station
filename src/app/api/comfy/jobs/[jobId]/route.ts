import { NextResponse } from "next/server";

import { ComfyClient, ComfyError } from "@/modules/comfy/client";
import { importComfyOutputToProject } from "@/modules/comfy/importOutput";
import { readComfyJob, updateComfyJob, type ComfyTrackedJob } from "@/modules/comfy/jobs";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";

type ComfyJobRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

function serializeJob(job: ComfyTrackedJob) {
  return {
    error: job.error,
    imagePath: job.imagePath,
    jobId: job.jobId,
    manifestPath: job.manifestPath ? relativeProjectPath(job.manifestPath) : undefined,
    promptId: job.promptId,
    projectId: job.projectId,
    status: job.status,
    success: job.status !== "failed" && job.status !== "timeout",
    workflowType: job.workflowType,
  };
}

async function importCompletedJob(job: ComfyTrackedJob, client: ComfyClient): Promise<ComfyTrackedJob> {
  const outputs = await client.retrieveOutputs(job.promptId);
  const [firstOutput] = outputs;

  if (!firstOutput) {
    throw new ComfyError(`ComfyUI job has no retrievable outputs: ${job.promptId}`, {
      code: "COMFY_MISSING_OUTPUT",
      statusCode: 502,
    });
  }

  const imported = await importComfyOutputToProject({
    client,
    output: firstOutput,
    projectId: job.projectId,
  });

  return updateComfyJob(job.jobId, {
    imagePath: imported.imagePath,
    manifestPath: imported.manifestPath,
    status: "completed",
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = await readComfyJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Comfy job was not found." }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "timeout") {
    return NextResponse.json(serializeJob(job));
  }

  if (job.status === "importing") {
    try {
      const completedJob = await importCompletedJob(job, new ComfyClient());
      return NextResponse.json(serializeJob(completedJob));
    } catch (error) {
      const routeError = error as ComfyJobRouteError;
      const failedJob = await updateComfyJob(job.jobId, {
        error: routeError.message || "Comfy image import failed.",
        status: "failed",
      });

      return NextResponse.json(serializeJob(failedJob), { status: routeError.statusCode ?? 500 });
    }
  }

  const elapsedMs = Date.now() - Date.parse(job.createdAt);
  if (elapsedMs > job.timeoutMs) {
    const timedOutJob = await updateComfyJob(job.jobId, {
      error: `ComfyUI job timed out after ${job.timeoutMs}ms.`,
      status: "timeout",
    });

    return NextResponse.json(serializeJob(timedOutJob), { status: 504 });
  }

  const client = new ComfyClient();

  try {
    const runtimeStatus = await client.getPromptRuntimeStatus(job.promptId);

    if (runtimeStatus === "failed") {
      const failedJob = await updateComfyJob(job.jobId, {
        error: `ComfyUI job failed: ${job.promptId}`,
        status: "failed",
      });

      return NextResponse.json(serializeJob(failedJob), { status: 502 });
    }

    if (runtimeStatus === "completed") {
      const importingJob = await updateComfyJob(job.jobId, { status: "importing" });
      return NextResponse.json(serializeJob(importingJob));
    }

    const nextStatus = runtimeStatus === "queued" ? "queued" : "running";
    const updatedJob = nextStatus === job.status ? job : await updateComfyJob(job.jobId, { status: nextStatus });
    return NextResponse.json(serializeJob(updatedJob));
  } catch (error) {
    const routeError = error as ComfyJobRouteError;

    return NextResponse.json(
      {
        ...serializeJob(job),
        details: routeError.details ?? [],
        error: routeError.message || "Comfy job status lookup failed.",
      },
      { status: routeError.statusCode ?? 503 },
    );
  }
}