import { NextResponse } from "next/server";

import {
  generateCreativeStrategyReport,
  readCreativeStrategyReport,
} from "@/modules/creative-strategy";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  const { id: projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const report = await readCreativeStrategyReport(projectId);

    if (!report) {
      return NextResponse.json(
        { error: "No creative strategy report found. Generate one first." },
        { status: 404 },
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json(
      { error: err.message || "Failed to read creative strategy report." },
      { status: err.statusCode ?? 500 },
    );
  }
}

export async function POST(_request: Request, context: RouteParams) {
  const { id: projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const report = await generateCreativeStrategyReport(projectId);
    return NextResponse.json(report);
  } catch (error) {
    const err = error as Error & { statusCode?: number; details?: string[] };
    return NextResponse.json(
      { details: err.details, error: err.message || "Failed to generate creative strategy report." },
      { status: err.statusCode ?? 500 },
    );
  }
}
