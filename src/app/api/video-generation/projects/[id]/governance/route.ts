import { NextResponse } from "next/server";

import {
  generateProviderExecutionPlan,
  readProviderExecutionPlan,
} from "@/modules/video-generation/governance";

type ProviderGovernanceRouteError = Error & {
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

  const providerExecutionPlan = await readProviderExecutionPlan(projectId);

  if (!providerExecutionPlan) {
    return NextResponse.json({ error: "Provider execution plan not found.", projectId }, { status: 404 });
  }

  return NextResponse.json({ projectId, providerExecutionPlan, success: true });
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

    const providerExecutionPlan = await generateProviderExecutionPlan(projectId);

    return NextResponse.json({ projectId, providerExecutionPlan, success: true });
  } catch (error) {
    const routeError = error as ProviderGovernanceRouteError;

    return NextResponse.json(
      {
        details: routeError.details ?? [],
        error: routeError.message || "Provider governance simulation failed.",
      },
      { status: routeError.statusCode ?? 500 },
    );
  }
}