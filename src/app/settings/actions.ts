"use server";

import { testAiProviderConnection } from "@/lib/aiProvider";
import { redirect } from "next/navigation";

export async function testAiConnection() {
  const result = await testAiProviderConnection();
  const params = new URLSearchParams({
    aiHealth: result.ok ? "ok" : "error",
    aiMessage: result.message,
  });

  redirect(`/settings?${params.toString()}`);
}
