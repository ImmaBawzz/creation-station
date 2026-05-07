import { describe, expect, it } from "vitest";

import { detectIdeaRoute } from "@/lib/intelligence/router";

describe("detectIdeaRoute", () => {
  it("returns a high-confidence pipeline route from category and keyword matches", () => {
    const route = detectIdeaRoute({
      category: "music",
      rawText: "Build a vocal hook and release plan for the song.",
      tags: "lyrics, beat, suno",
      title: "Album track concept",
    });

    expect(route).toEqual({
      confidence: "high",
      id: "music",
      label: "Music",
      pipeline: "Music pipeline",
      reasons: ["category: music", "title: album"],
    });
  });

  it("falls back to the general pipeline when no route scores", () => {
    const route = detectIdeaRoute({
      category: "misc",
      rawText: "A quiet note with no known production signals.",
      tags: "",
      title: "Loose thought",
    });

    expect(route).toEqual({
      confidence: "low",
      id: "general",
      label: "General",
      pipeline: "General planning",
      reasons: [],
    });
  });

  it("handles nullish runtime input values without throwing", () => {
    const route = detectIdeaRoute({
      category: undefined,
      rawText: null,
      tags: undefined,
      title: null,
    } as unknown as Parameters<typeof detectIdeaRoute>[0]);

    expect(route.id).toBe("general");
    expect(route.confidence).toBe("low");
  });
});
