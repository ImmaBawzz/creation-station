import { describe, expect, it } from "vitest";

import { resolveComfyModelAlias } from "@/modules/comfy/modelAliases";

describe("comfy model aliases", () => {
  it("prefers exact matches when available", () => {
    const result = resolveComfyModelAlias({
      availableFiles: ["flux1-dev.safetensors"],
      family: "unet",
      loaderType: "UNETLoader",
      requiredName: "flux1-dev.safetensors",
    });

    expect(result.exactMatch).toBe(true);
    expect(result.missing).toBe(false);
    expect(result.resolvedName).toBe("flux1-dev.safetensors");
  });

  it("resolves approved aliases when exact names differ", () => {
    const result = resolveComfyModelAlias({
      availableFiles: ["flux1-dev-fp8.safetensors"],
      family: "unet",
      loaderType: "UNETLoader",
      requiredName: "flux1-dev.safetensors",
    });

    expect(result.exactMatch).toBe(false);
    expect(result.missing).toBe(false);
    expect(result.resolvedName).toBe("flux1-dev-fp8.safetensors");
  });

  it("blocks gguf aliases for UNETLoader workflows", () => {
    const result = resolveComfyModelAlias({
      availableFiles: ["flux1-dev-Q8.gguf"],
      family: "unet",
      loaderType: "UNETLoader",
      requiredName: "flux1-dev.safetensors",
    });

    expect(result.ggufBlocked).toBe(true);
    expect(result.missing).toBe(true);
  });

  it("keeps schnell out of the production alias path", () => {
    const result = resolveComfyModelAlias({
      availableFiles: ["flux1-schnell.safetensors"],
      family: "unet",
      loaderType: "UNETLoader",
      requiredName: "flux1-dev.safetensors",
    });

    expect(result.missing).toBe(true);
    expect(result.warnings).toContain("Found FLUX Schnell locally, but keep it under Fast Concept only.");
  });
});