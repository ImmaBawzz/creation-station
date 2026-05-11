import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  applyManualOverride,
  getSceneStatus,
  readRegenerationReport,
  resetFailureMemory,
  runRegenerationGovernor,
} from "@/modules/regeneration-governor";

type GovernorErrorWithStatus = Error & {
  details?: string[];
  statusCode?: number;
};

function errorResponse(error: unknown) {
  const err = error as GovernorErrorWithStatus;
  return NextResponse.json(
    { details: err.details, error: err.message || "Regeneration governor failed." },
    { status: err.statusCode ?? 500 },
  );
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const sceneId = request.nextUrl.searchParams.get("sceneId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    // Return scene-level status if requested
    if (sceneId) {
      const sceneStatus = await getSceneStatus(projectId, sceneId);
      return NextResponse.json(sceneStatus ?? { message: "No failure record for this scene." });
    }

    const report = await readRegenerationReport(projectId);

    if (!report) {
      return NextResponse.json(
        { error: "No regeneration report found. Run the governor first." },
        { status: 404 },
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string; projectId?: string };
    const { action, projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    switch (action) {
      case "manual-override": {
        const report = await applyManualOverride(projectId);
        return NextResponse.json(report);
      }

      case "reset-memory": {
        await resetFailureMemory(projectId);
        return NextResponse.json({ message: "Failure memory reset.", projectId });
      }

      default: {
        const report = await runRegenerationGovernor(projectId);
        return NextResponse.json(report);
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}
