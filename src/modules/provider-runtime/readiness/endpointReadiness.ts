import type { ProviderType } from "../types";

export function getProviderEnableFlag(providerId: ProviderType): string | undefined {
  switch (providerId) {
    case "mock":
      return undefined;
    case "comfy":
      return "PROVIDER_RUNTIME_ENABLE_COMFY";
    case "wan":
      return "PROVIDER_RUNTIME_ENABLE_WAN";
    case "kling":
      return "PROVIDER_RUNTIME_ENABLE_KLING";
    case "runway":
      return "PROVIDER_RUNTIME_ENABLE_RUNWAY";
  }
}

export function isProviderExecutionEnabled(providerId: ProviderType): boolean {
  const flag = getProviderEnableFlag(providerId);

  if (!flag) {
    return true;
  }

  return process.env[flag] === "true";
}

export function getProviderEnableRequirements(providerId: ProviderType): string[] {
  const flag = getProviderEnableFlag(providerId);

  if (!flag || isProviderExecutionEnabled(providerId)) {
    return [];
  }

  return [flag];
}
