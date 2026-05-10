import { NextResponse } from "next/server";

import { getSingleWorkflowCertificationReport } from "@/modules/provider-runtime/workflowCertification";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await context.params;

  return NextResponse.json(getSingleWorkflowCertificationReport(workflowId));
}
