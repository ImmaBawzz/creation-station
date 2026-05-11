import { NextResponse } from "next/server";

import { runSceneVideoGeneration } from "@/modules/video-generation";

type SceneVideoRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const projectId = id?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const state = await runSceneVideoGeneration(projectId);

    return NextResponse.json({ projectId, state, success: true });
  } catch (error) {
    const routeError = error as SceneVideoRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Scene video run failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}