import { NextResponse } from "next/server";

import { generateTimelinePlan, readTimelinePlan } from "@/modules/timeline-director";

type TimelineDirectorRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const timelinePlan = await readTimelinePlan(projectId);

  if (!timelinePlan) {
    return NextResponse.json({ error: "Timeline plan not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, success: true, timelinePlan });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { projectId?: string };
    const projectId = payload.projectId?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const timelinePlan = await generateTimelinePlan(projectId);

    return NextResponse.json({ projectId, success: true, timelinePlan });
  } catch (error) {
    const routeError = error as TimelineDirectorRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Timeline plan generation failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}