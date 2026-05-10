import { NextResponse } from "next/server";

import { listProviderReadiness } from "@/modules/provider-runtime/readiness";

export async function GET() {
  return NextResponse.json({
    providers: listProviderReadiness(),
  });
}
