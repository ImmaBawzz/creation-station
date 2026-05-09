import { NextResponse } from "next/server";

import { getSceneVideoGenerationState } from "@/modules/video-generation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const projectId = id?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const state = await getSceneVideoGenerationState(projectId);

  if (!state) {
    return NextResponse.json({ error: "Scene video manifest not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, state, success: true });
}