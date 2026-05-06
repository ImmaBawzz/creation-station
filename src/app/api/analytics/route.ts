import { logAnalyticsEvent, type AnalyticsEventType } from "@/lib/analytics";

const allowedClientEvents = new Set<AnalyticsEventType>([
  "onboarding_completed",
  "onboarding_skipped",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = body?.eventType;

    if (!allowedClientEvents.has(eventType)) {
      return Response.json({ error: "Unsupported analytics event." }, { status: 400 });
    }

    await logAnalyticsEvent(eventType, {
      source: "client",
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Analytics event was not recorded." }, { status: 400 });
  }
}
