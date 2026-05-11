import { NextResponse } from "next/server";

import {
  cancelSceneExecution,
  getSceneExecutionState,
  pauseSceneExecution,
  resumeSceneExecution,
  startSceneExecution,
} from "@/modules/scene-execution";

type SceneExecutionRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const state = await getSceneExecutionState(projectId);

  if (!state) {
    return NextResponse.json({ error: "Scene execution batch not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, state, success: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      action?: string;
      approvedSceneIds?: string[];
      concurrency?: number;
      negativePrompt?: string;
      projectId?: string;
    };
    const action = payload.action?.trim();
    const projectId = payload.projectId?.trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: "action is required." }, { status: 400 });
    }

    const state = action === "start"
      ? await startSceneExecution({
          approvedSceneIds: Array.isArray(payload.approvedSceneIds) ? payload.approvedSceneIds : [],
          concurrency: payload.concurrency,
          negativePrompt: payload.negativePrompt,
          projectId,
        })
      : action === "pause"
      ? await pauseSceneExecution(projectId)
      : action === "resume"
      ? await resumeSceneExecution(projectId)
      : action === "cancel"
      ? await cancelSceneExecution(projectId)
      : null;

    if (!state) {
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ projectId, state, success: true });
  } catch (error) {
    const routeError = error as SceneExecutionRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Scene execution action failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}
