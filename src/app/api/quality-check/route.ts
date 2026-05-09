import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { approveOverride, readQualityReport, runQualityCheck } from "@/modules/quality-director";

type ErrorWithStatus = Error & {
  details?: string[];
  statusCode?: number;
};

function errorResponse(error: unknown) {
  const err = error as ErrorWithStatus;
  const statusCode = err.statusCode ?? 500;
  const message = err.message || "Quality check failed.";

  return NextResponse.json(
    { details: err.details, error: message },
    { status: statusCode },
  );
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const report = await readQualityReport(projectId);

    if (!report) {
      return NextResponse.json(
        { error: "No quality report found. Run a quality check first." },
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
      return NextResponse.json(
        { error: "projectId is required." },
        { status: 400 },
      );
    }

    if (action === "approve-override") {
      const report = await approveOverride(projectId);
      return NextResponse.json(report);
    }

    const report = await runQualityCheck(projectId);
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}
