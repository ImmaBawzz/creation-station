import { NextResponse } from "next/server";

import { generateSceneMotionPlan, readSceneMotionPlan } from "@/modules/motion-director";

type MotionDirectorRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const motionPlan = await readSceneMotionPlan(projectId);

  if (!motionPlan) {
    return NextResponse.json({ error: "Scene motion plan not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ motionPlan, projectId, success: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { projectId?: string };
    const projectId = payload.projectId?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const motionPlan = await generateSceneMotionPlan(projectId);

    return NextResponse.json({ motionPlan, projectId, success: true });
  } catch (error) {
    const routeError = error as MotionDirectorRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Motion plan generation failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}