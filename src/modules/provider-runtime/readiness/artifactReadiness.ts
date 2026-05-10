import type { ProviderType } from "../types";

export function getArtifactReadinessWarnings(providerId: ProviderType): string[] {
  if (providerId === "mock") {
    return [];
  }

  return ["Artifact validation is not enabled until provider certification is run."];
}
