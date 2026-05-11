import { NextResponse } from "next/server";

import { generateScenePlanForProject, readScenePlan } from "@/modules/scene-planner";

type ScenePlannerRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const plan = await readScenePlan(projectId);

  if (!plan) {
    return NextResponse.json({ error: "Scene plan not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, scenePlan: plan, success: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      creativeDirection?: string;
      projectId?: string;
      regenerateSceneId?: string;
      songDuration?: number;
      stylePreset?: string;
    };
    const projectId = payload.projectId?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const result = await generateScenePlanForProject({
      creativeDirection: payload.creativeDirection,
      projectId,
      regenerateSceneId: payload.regenerateSceneId,
      songDuration: payload.songDuration,
      stylePreset: payload.stylePreset,
    });

    return NextResponse.json({
      planPath: result.planPath,
      projectId,
      sceneCount: result.plan.scenes.length,
      scenePlan: result.plan,
      songDuration: result.songDuration,
      success: true,
      timestampSource: result.timestampSource,
    });
  } catch (error) {
    const routeError = error as ScenePlannerRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Scene planning failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}
