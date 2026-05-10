import {
  mapCanonicalPayloadToComfy,
  mapCanonicalPayloadToKling,
  mapCanonicalPayloadToMock,
  mapCanonicalPayloadToRunway,
  mapCanonicalPayloadToWan,
} from "../payloadMappers";
import type { ProviderJobRequest } from "../types";
import type { ProviderPayloadInspection } from "./readinessTypes";

export function mapPayloadForInspection(job: ProviderJobRequest): Pick<ProviderPayloadInspection, "mappedPayload" | "missingRequirements" | "warnings"> {
  const result = job.provider === "mock"
    ? mapCanonicalPayloadToMock(job)
    : job.provider === "comfy"
      ? mapCanonicalPayloadToComfy(job)
      : job.provider === "wan"
        ? mapCanonicalPayloadToWan(job)
        : job.provider === "kling"
          ? mapCanonicalPayloadToKling(job)
          : mapCanonicalPayloadToRunway(job);

  if (!result.ok) {
    return {
      mappedPayload: undefined,
      missingRequirements: [result.errorCode],
      warnings: result.warnings,
    };
  }

  return {
    mappedPayload: result.payload,
    missingRequirements: [],
    warnings: result.warnings,
  };
}
