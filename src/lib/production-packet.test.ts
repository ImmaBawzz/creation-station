import { describe, expect, it } from "vitest";

import {
  PRODUCTION_PACKET_DRAFT_TITLE,
  PRODUCTION_TASK_DEFINITIONS,
  buildProductionPacket,
  productionPacketFilename,
} from "./production-packet";

describe("production packet", () => {
  it("builds a deterministic manual production packet from content fields", () => {
    const packet = buildProductionPacket({
      brief: {
        angle: "Build in public walkthrough",
        cta: "Save this workflow",
        keywords: "creator workflow",
        notes: "Mention the private beta offer manually.",
        objective: "Show the first complete creator run",
        outline: "Open with the pain\nShow the packet\nClose with the manual publish step",
        promise: "Move from idea to publish-ready content without external automation",
      },
      item: {
        audience: "Solo creators",
        coreIdea: "Turn one raw idea into a complete content run.",
        format: "SHORT_VIDEO",
        primaryPlatform: "YOUTUBE",
        tags: "creator, workflow",
        title: "Creator Run Demo",
      },
    });

    expect(packet).toContain(`# ${PRODUCTION_PACKET_DRAFT_TITLE}: Creator Run Demo`);
    expect(packet).toContain("Duration: 30-60 seconds");
    expect(packet).toContain("## Music Brief");
    expect(packet).toContain("## Image Prompts");
    expect(packet).toContain("## Scene List");
    expect(packet).toContain("## Video Assembly Plan");
    expect(packet).toContain("## Publishing Checklist");
    expect(packet).toContain("## Monetization Note");
    expect(packet).toContain("## Metrics Reminder");
    expect(packet).toContain("#creator #workflow");
  });

  it("keeps the required production task list stable", () => {
    expect(PRODUCTION_TASK_DEFINITIONS.map((task) => task.title)).toEqual([
      "Finalize concept",
      "Finalize script",
      "Prepare music prompt",
      "Create/select music manually",
      "Prepare image prompts",
      "Create/select images manually",
      "Assemble video manually",
      "Review final video",
      "Prepare caption/hashtags",
      "Publish manually",
      "Record metrics snapshot",
    ]);
  });

  it("creates a safe markdown filename", () => {
    expect(productionPacketFilename("Creator Run: Demo!")).toBe(
      "creator-run-demo-production-packet.md",
    );
  });
});
