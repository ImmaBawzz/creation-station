import { NextResponse } from "next/server";

import { inspectProviderPayload } from "@/modules/provider-runtime/readiness";
import { validateProviderJobRequest } from "@/modules/provider-runtime/types";
import type { ProviderJobRequest, ProviderType } from "@/modules/provider-runtime/types";

const PROVIDERS = new Set<ProviderType>(["mock", "comfy", "wan", "kling", "runway"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  const { providerId: rawProviderId } = await context.params;
  const providerId = rawProviderId as ProviderType;

  if (!PROVIDERS.has(providerId)) {
    return NextResponse.json({ error: "Unsupported providerId." }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as Partial<ProviderJobRequest> | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be a ProviderJobRequest object." }, { status: 400 });
  }

  const job = {
    ...body,
    provider: providerId,
  } as ProviderJobRequest;
  const errors = validateProviderJobRequest(job);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const inspection = inspectProviderPayload(job);

  return NextResponse.json({
    executionMode: inspection.executionMode,
    mappedPayload: inspection.mappedPayload,
    missingRequirements: inspection.missingRequirements,
    providerId: inspection.providerId,
    readinessLevel: inspection.readinessLevel,
    warnings: inspection.warnings,
  });
}
