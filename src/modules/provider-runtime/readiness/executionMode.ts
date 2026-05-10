import type { ProviderRuntimeExecutionMode } from "./readinessTypes";

const VALID_EXECUTION_MODES = new Set<ProviderRuntimeExecutionMode>([
  "disabled",
  "inspect",
  "dry-run",
  "certify",
  "execute",
]);

export function getProviderRuntimeExecutionMode(): ProviderRuntimeExecutionMode {
  const rawMode = process.env.PROVIDER_RUNTIME_EXECUTION_MODE;

  if (VALID_EXECUTION_MODES.has(rawMode as ProviderRuntimeExecutionMode)) {
    return rawMode as ProviderRuntimeExecutionMode;
  }

  return "disabled";
}
