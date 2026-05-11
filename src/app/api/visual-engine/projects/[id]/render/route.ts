import { NextResponse } from "next/server";

import { renderProject } from "@/modules/visual-engine/render/renderProject";

type RenderRouteError = Error & {
  details?: string[];
  statusCode?: number;
};

type RenderRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: RenderRouteContext,
) {
  const { id } = await context.params;

  try {
    const result = await renderProject(id);
    return NextResponse.json(result);
  } catch (error) {
    const renderError = error as RenderRouteError;

    return NextResponse.json(
      {
        details: renderError.details ?? [],
        error: renderError.message || "Render failed.",
        projectId: id,
      },
      { status: renderError.statusCode ?? 500 },
    );
  }
}
