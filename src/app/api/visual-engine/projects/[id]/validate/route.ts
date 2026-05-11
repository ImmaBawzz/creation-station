import { NextResponse } from "next/server";

import { validateVisualProjectById } from "@/modules/visual-engine/validate";

type ValidateRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: ValidateRouteContext,
) {
  const { id } = await context.params;
  const result = await validateVisualProjectById(id);

  if (!result) {
    return NextResponse.json(
      {
        error: "Visual Engine project was not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
