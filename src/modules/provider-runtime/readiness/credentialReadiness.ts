import type { ProviderType } from "../types";

export function getCredentialRequirements(providerId: ProviderType): string[] {
  switch (providerId) {
    case "mock":
      return [];
    case "comfy":
      return process.env.COMFY_API_URL ? [] : ["COMFY_API_URL"];
    case "wan":
      return process.env.WAN_API_KEY ? [] : ["WAN_API_KEY"];
    case "kling":
      return process.env.KLING_API_KEY ? [] : ["KLING_API_KEY"];
    case "runway":
      return process.env.RUNWAY_API_KEY ? [] : ["RUNWAY_API_KEY"];
  }
}

export function hasProviderCredentials(providerId: ProviderType): boolean {
  return getCredentialRequirements(providerId).length === 0;
}
