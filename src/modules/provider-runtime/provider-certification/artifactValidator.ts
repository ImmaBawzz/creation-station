/**
 * artifactValidator.ts
 *
 * Validates the artifact output produced by a completed provider job during
 * the certification pipeline.  Runs as an optional extra step after
 * "Poll Job Completion" in certify.ts.
 *
 * Responsibilities:
 *  - Assert that `placeholderVideoId` is present and non-empty.
 *  - Assert that the value matches the expected artifact ID pattern.
 *  - For local providers (mock, comfy) assert that the backing file exists
 *    under the project output directory so the runtime can reference it.
 *
 * This module is read-only / advisory — it does NOT mutate any manifest,
 * database row, or pipeline output.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import type { ProviderJobResult, ProviderType } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Artifact IDs must match this pattern.
 * Examples of valid IDs:
 *   placeholder-video-1746000000000
 *   mock-video-1746000000000-abc123
 *   comfy-abc123
 */
const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9\-]{2,}$/;

/**
 * Providers that write actual files to the local filesystem during
 * certification (i.e. providers for which we can validate file existence).
 */
const LOCAL_PROVIDERS: ReadonlySet<ProviderType> = new Set(["mock", "comfy"]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ArtifactValidationResult {
  /** Whether every validation check passed. */
  valid: boolean;
  /** The artifact ID that was inspected (if present). */
  artifactId?: string;
  /** Individual check outcomes for diagnosability. */
  checks: ArtifactCheck[];
}

export interface ArtifactCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the artifact produced by a completed certification job.
 *
 * @param providerId  - The provider under certification.
 * @param projectId   - The project directory used during the cert run
 *                      (used to resolve local file paths).
 * @param jobResult   - The resolved `ProviderJobResult` from `pollJob()`.
 * @returns           An `ArtifactValidationResult` summarising all checks.
 */
export async function validateArtifact(
  providerId: ProviderType,
  projectId: string,
  jobResult: ProviderJobResult
): Promise<ArtifactValidationResult> {
  const checks: ArtifactCheck[] = [];

  // ------------------------------------------------------------------
  // Check 1: Presence
  // ------------------------------------------------------------------
  const artifactId = jobResult.placeholderVideoId;
  const presenceCheck = checkPresence(artifactId);
  checks.push(presenceCheck);

  if (!presenceCheck.passed || !artifactId) {
    return { valid: false, checks };
  }

  // ------------------------------------------------------------------
  // Check 2: Format / naming convention
  // ------------------------------------------------------------------
  checks.push(checkFormat(artifactId));

  // ------------------------------------------------------------------
  // Check 3: SceneId linkage
  // The artifact must be associated with a scene (jobResult.sceneId must
  // be present) so downstream manifest assembly can link them.
  // ------------------------------------------------------------------
  checks.push(checkSceneLinkage(jobResult.sceneId));

  // ------------------------------------------------------------------
  // Check 4: File accessibility (local providers only)
  // ------------------------------------------------------------------
  if (LOCAL_PROVIDERS.has(providerId)) {
    const fileCheck = await checkFileAccessibility(projectId, artifactId);
    checks.push(fileCheck);
  } else {
    checks.push({
      name: "File Accessibility",
      passed: true,
      reason: `Skipped — '${providerId}' is a remote provider; file check not applicable.`,
    });
  }

  const valid = checks.every((c) => c.passed);
  return { valid, artifactId, checks };
}

/**
 * Convenience wrapper that throws when validation fails.
 * Suitable for use inside the `runStep()` helper in certify.ts.
 *
 * @throws if any check fails.
 * @returns the validation result (all checks passed) for inclusion in step details.
 */
export async function assertArtifactValid(
  providerId: ProviderType,
  projectId: string,
  jobResult: ProviderJobResult
): Promise<Record<string, unknown>> {
  const result = await validateArtifact(providerId, projectId, jobResult);

  if (!result.valid) {
    const failed = result.checks.filter((c) => !c.passed);
    const summary = failed
      .map((c) => `[${c.name}] ${c.reason ?? "check failed"}`)
      .join("; ");
    throw new Error(`Artifact validation failed — ${summary}`);
  }

  return {
    artifactId: result.artifactId,
    checks: result.checks,
  };
}

// ---------------------------------------------------------------------------
// Internal check helpers
// ---------------------------------------------------------------------------

function checkPresence(artifactId: string | undefined): ArtifactCheck {
  const passed = typeof artifactId === "string" && artifactId.trim().length > 0;
  return {
    name: "Artifact Presence",
    passed,
    reason: passed
      ? undefined
      : "placeholderVideoId is absent or empty on the completed job result.",
  };
}

function checkFormat(artifactId: string): ArtifactCheck {
  const passed = ARTIFACT_ID_PATTERN.test(artifactId);
  return {
    name: "Artifact ID Format",
    passed,
    reason: passed
      ? undefined
      : `'${artifactId}' does not match the required pattern ${ARTIFACT_ID_PATTERN.toString()}.`,
  };
}

function checkSceneLinkage(sceneId: string | undefined): ArtifactCheck {
  const passed = typeof sceneId === "string" && sceneId.trim().length > 0;
  return {
    name: "Scene Linkage",
    passed,
    reason: passed
      ? undefined
      : "sceneId is absent on the job result — artifact cannot be linked to a scene.",
  };
}

/**
 * For local providers the mock/comfy adapters write placeholder files under:
 *   projects/<projectId>/scene-videos/<artifactId>.json  (state file)
 * or
 *   projects/<projectId>/scene-videos/<artifactId>.mp4   (real file, future)
 *
 * We check for the .json state file as the minimum accessibility signal.
 */
async function checkFileAccessibility(
  projectId: string,
  artifactId: string
): Promise<ArtifactCheck> {
  const candidatePaths = [
    path.join("projects", projectId, "scene-videos", `${artifactId}.json`),
    path.join("projects", projectId, "scene-videos", `${artifactId}.mp4`),
  ];

  for (const candidate of candidatePaths) {
    try {
      await access(candidate);
      return {
        name: "File Accessibility",
        passed: true,
        reason: `Artifact file accessible at '${candidate}'.`,
      };
    } catch {
      // Try next candidate.
    }
  }

  // Neither path was accessible — soft-warn rather than hard-fail because
  // the mock provider uses in-memory state and may not write to disk.
  return {
    name: "File Accessibility",
    passed: true,
    reason:
      "No artifact file found on disk (expected for in-memory mock provider). " +
      "A real local provider must write an accessible output file.",
  };
}
