import { NextResponse } from "next/server";

import { db } from "@/lib/db";

function parseResult(result: string): Record<string, unknown> | null {
  if (!result) {
    return null;
  }

  try {
    const parsed = JSON.parse(result) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const executionRequest = await db.executionRequest.findUnique({
    where: { id },
  });

  if (!executionRequest) {
    return NextResponse.json({ error: "Music video request was not found." }, { status: 404 });
  }

  const result = parseResult(executionRequest.result);
  const downloads = executionRequest.status === "completed"
    ? {
        finalMp4: `/api/music-video-builder/${executionRequest.id}/download?file=finalMp4`,
        metadata: `/api/music-video-builder/${executionRequest.id}/download?file=metadata`,
        promptText: `/api/music-video-builder/${executionRequest.id}/download?file=promptText`,
        thumbnail: `/api/music-video-builder/${executionRequest.id}/download?file=thumbnail`,
        workflow: `/api/music-video-builder/${executionRequest.id}/download?file=workflow`,
      }
    : null;

  return NextResponse.json({
    request: {
      actionType: executionRequest.actionType,
      completedAt: executionRequest.completedAt,
      createdAt: executionRequest.createdAt,
      error: executionRequest.error,
      id: executionRequest.id,
      result,
      status: executionRequest.status,
    },
    downloads,
  });
}
