import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { parseWorkspaceBackup } from "@/lib/backup";

describe("parseWorkspaceBackup content records", () => {
  it("parses content pipeline backup records with relationships", () => {
    const parsed = parseWorkspaceBackup({
      contentItems: [
        {
          audience: "Solo creators",
          coreIdea: "Show the workflow",
          createdAt: "2026-05-11T00:00:00.000Z",
          format: "SHORT_VIDEO",
          id: "content-1",
          primaryPlatform: "YOUTUBE",
          status: "PUBLISHED",
          tags: "launch",
          title: "Launch clip",
          updatedAt: "2026-05-11T00:00:00.000Z",
        },
      ],
      contentBriefs: [
        {
          angle: "Demo",
          contentItemId: "content-1",
          createdAt: "2026-05-11T00:00:00.000Z",
          cta: "Subscribe",
          id: "brief-1",
          keywords: "workflow",
          notes: "Keep it tight",
          objective: "Explain MVP",
          outline: "Hook\nSteps",
          promise: "Ship faster",
          updatedAt: "2026-05-11T00:00:00.000Z",
        },
      ],
      contentDrafts: [
        {
          body: "Draft body",
          contentItemId: "content-1",
          createdAt: "2026-05-11T00:00:00.000Z",
          id: "draft-1",
          status: "READY",
          title: "Draft",
          updatedAt: "2026-05-11T00:00:00.000Z",
          version: 1,
        },
      ],
      contentMetrics: [
        {
          capturedAt: "2026-05-11T00:00:00.000Z",
          clicks: 7,
          comments: 2,
          contentItemId: "content-1",
          createdAt: "2026-05-11T00:00:00.000Z",
          id: "metric-1",
          likes: 11,
          notes: "",
          platform: "YOUTUBE",
          saves: 3,
          shares: 4,
          views: 100,
        },
      ],
      monetizationLinks: [
        {
          actualRevenueCents: 1999,
          contentItemId: "content-1",
          createdAt: "2026-05-11T00:00:00.000Z",
          currency: "USD",
          expectedValueCents: 5000,
          id: "money-1",
          method: "AFFILIATE",
          notes: "",
          offerName: "Creator kit",
          offerUrl: "https://example.com/offer",
          updatedAt: "2026-05-11T00:00:00.000Z",
        },
      ],
      publishingTargets: [
        {
          caption: "Watch this",
          checklist: "Thumbnail ready",
          contentItemId: "content-1",
          createdAt: "2026-05-11T00:00:00.000Z",
          hashtags: "#buildinpublic",
          id: "target-1",
          platform: "YOUTUBE",
          publishedAt: "2026-05-11T00:00:00.000Z",
          publishUrl: "https://example.com/video",
          scheduledAt: null,
          status: "PUBLISHED",
          updatedAt: "2026-05-11T00:00:00.000Z",
        },
      ],
    });

    expect(parsed.contentItems).toHaveLength(1);
    expect(parsed.contentBriefs).toHaveLength(1);
    expect(parsed.contentDrafts[0]).toMatchObject({
      contentItemId: "content-1",
      status: "READY",
      version: 1,
    });
    expect(parsed.publishingTargets[0]).toMatchObject({
      platform: "YOUTUBE",
      status: "PUBLISHED",
    });
    expect(parsed.contentMetrics[0]).toMatchObject({
      views: 100,
      clicks: 7,
    });
    expect(parsed.monetizationLinks[0]).toMatchObject({
      actualRevenueCents: 1999,
      method: "AFFILIATE",
    });
  });
});
