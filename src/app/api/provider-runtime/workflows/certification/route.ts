import { NextResponse } from "next/server";

import { getWorkflowCertificationReport } from "@/modules/provider-runtime/workflowCertification";

export async function GET() {
  return NextResponse.json(getWorkflowCertificationReport());
}
