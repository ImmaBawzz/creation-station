import { NextResponse } from "next/server";

import { createExecutionRequest } from "@/lib/autonomy/execution-request-store";

function isPayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;

  if (!isPayload(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const actionType = typeof body.actionType === "string" ? body.actionType.trim() : "";
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const payload = isPayload(body.payload) ? body.payload : null;

  if (!actionType || !payload) {
    return NextResponse.json(
      { error: "actionType and payload are required." },
      { status: 400 },
    );
  }

  const result = await createExecutionRequest({
    actionType,
    payload,
    taskId,
  });

  return NextResponse.json(
    {
      duplicate: result.duplicate,
      request: result.request,
    },
    { status: result.duplicate ? 200 : 201 },
  );
}
