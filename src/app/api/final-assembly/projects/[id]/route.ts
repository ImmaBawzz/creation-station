import { NextResponse } from "next/server";

import { assembleFinalVideo, readFinalAssemblyState } from "@/modules/final-assembly";

type FinalAssemblyRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const projectId = id?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const state = await readFinalAssemblyState(projectId);

  if (!state) {
    return NextResponse.json({ error: "Final assembly state not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, state, success: true });
}

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

    const result = await assembleFinalVideo(projectId);
    const state = await readFinalAssemblyState(projectId);

    return NextResponse.json({ projectId, result, state, success: true });
  } catch (error) {
    const routeError = error as FinalAssemblyRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Final assembly failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}