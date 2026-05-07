import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextResponse } from "next/server";

import { createExecutionRequest } from "@/lib/autonomy/execution-request-store";
import {
  getMusicVideoWorkflowPreset,
  hydrateWorkflowPrompt,
} from "@/lib/music-video-workflows";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "upload";
}

async function persistUpload({
  file,
  label,
  requestId,
}: {
  file: File;
  label: string;
  requestId: string;
}): Promise<string> {
  const extension = path.extname(file.name) || (label === "audio" ? ".wav" : ".png");
  const directory = path.join(process.cwd(), "output", "music-video-requests", requestId, "source");
  const targetPath = path.join(directory, `${label}-${safeFilePart(file.name || `${label}${extension}`)}`);

  await mkdir(directory, { recursive: true });
  await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

  return targetPath;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = clean(formData.get("title")) || "Untitled Music Video";
  const visualPrompt = clean(formData.get("visualPrompt"));
  const workflowPresetId = clean(formData.get("workflowPreset"));
  const durationSecondsRaw = Number(clean(formData.get("durationSeconds")));
  const audio = formData.get("audio");
  const sourceImage = formData.get("sourceImage");

  if (!(audio instanceof File) || audio.size <= 0) {
    return NextResponse.json({ error: "Audio upload is required." }, { status: 400 });
  }

  if (!visualPrompt) {
    return NextResponse.json({ error: "Visual prompt is required." }, { status: 400 });
  }

  const preset = getMusicVideoWorkflowPreset(workflowPresetId);

  if (!preset) {
    return NextResponse.json({ error: "Workflow preset is required." }, { status: 400 });
  }

  const requestId = randomUUID();
  const audioPath = await persistUpload({
    file: audio,
    label: "audio",
    requestId,
  });
  const sourceImagePath =
    sourceImage instanceof File && sourceImage.size > 0
      ? await persistUpload({
          file: sourceImage,
          label: "source-image",
          requestId,
        })
      : "";
  const workflow = hydrateWorkflowPrompt(preset.workflow, visualPrompt);
  const result = await createExecutionRequest({
    actionType: "music_video_builder_v1",
    payload: {
      audioPath,
      durationSeconds: Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
        ? Math.round(durationSecondsRaw)
        : 180,
      requestId,
      sourceImagePath: sourceImagePath || null,
      title,
      visualPrompt,
      workflow,
      workflowPreset: preset.id,
    },
    taskId: `music-video:${requestId}`,
  });

  return NextResponse.json(
    {
      duplicate: result.duplicate,
      request: {
        actionType: result.request.actionType,
        createdAt: result.request.createdAt,
        error: result.request.error,
        id: result.request.id,
        result: result.request.result,
        status: result.request.status,
      },
    },
    { status: result.duplicate ? 200 : 201 },
  );
}
