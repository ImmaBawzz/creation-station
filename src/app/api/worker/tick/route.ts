import { NextResponse } from "next/server";

import {
  markExecutionWorkerStopped,
  processNextExecutionRequest,
  recordWorkerHeartbeat,
} from "@/lib/autonomy/execution-worker";

type WorkerTickBody = {
  actionLimits?: Record<string, number>;
  shutdown?: boolean;
  workerId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as WorkerTickBody;
  const workerId = body.workerId?.trim() || "creation-station-daemon";

  if (body.shutdown) {
    const worker = await markExecutionWorkerStopped({ workerId });
    return NextResponse.json({ ok: true, worker });
  }

  await recordWorkerHeartbeat({
    status: "idle",
    workerId,
  });
  const result = await processNextExecutionRequest({
    actionLimits: body.actionLimits,
    workerId,
  });

  return NextResponse.json({ ok: true, result, workerId });
}
