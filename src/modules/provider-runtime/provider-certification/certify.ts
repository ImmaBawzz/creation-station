import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getProviderAdapter } from "../providerRegistry";
import type { ProviderType, ProviderJobRequest, ProviderJobResult } from "../types";
import type { CertificationReport, CertificationStep } from "./types";
import { assertArtifactValid } from "./artifactValidator";

const POLL_INTERVAL_MS = 10000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes max for certification test to avoid hanging indefinitely.

async function runStep(
  name: string,
  execute: () => Promise<Record<string, unknown> | void>
): Promise<CertificationStep> {
  const start = Date.now();
  try {
    const details = await execute();
    return {
      name,
      status: "passed",
      durationMs: Date.now() - start,
      details: details || undefined,
    };
  } catch (error: unknown) {
    return {
      name,
      status: "failed",
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createCertificationReferenceAsset(providerId: ProviderType): Promise<{ path: string; cleanup(): Promise<void> }> {
  if (providerId !== "mock") {
    return {
      path: "cert-img.png",
      cleanup: async () => {},
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "creation-station-provider-cert-"));
  const imagePath = path.join(tempDir, "cert-img.png");
  await writeFile(imagePath, "mock certification source image", "utf8");

  return {
    path: imagePath,
    cleanup: async () => {
      await rm(tempDir, { force: true, recursive: true });
    },
  };
}

export async function runCertification(providerId: ProviderType): Promise<CertificationReport> {
  const start = Date.now();
  const steps: CertificationStep[] = [];
  let cleanupReferenceAsset = async () => {};

  async function finish(): Promise<CertificationReport> {
    await cleanupReferenceAsset();
    return finalizeReport(providerId, start, steps);
  }
  
  let adapter;
  try {
    adapter = getProviderAdapter(providerId);
  } catch (err: unknown) {
    return {
      provider: providerId,
      certifiedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - start,
      overallStatus: "failed",
      steps: [{
        name: "Adapter Initialization",
        status: "failed",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      }],
    };
  }

  // Step 1: Config Validation
  const configStep = await runStep("Config Validation", async () => {
    const isValid = adapter.validateConfig();
    if (!isValid) throw new Error("validateConfig() returned false.");
  });
  steps.push(configStep);

  if (configStep.status === "failed") {
    return finish();
  }

  // Step 2: Health Check
  const healthStep = await runStep("Health Check", async () => {
    const health = await adapter.checkHealth();
    if (health === "offline") throw new Error("checkHealth() returned offline.");
    return { health };
  });
  steps.push(healthStep);

  // Step 3: Lifecycle - Submit
  const referenceAsset = await createCertificationReferenceAsset(providerId);
  cleanupReferenceAsset = referenceAsset.cleanup;
  const dummyJob: ProviderJobRequest = {
    id: `cert-${Date.now()}`,
    sceneId: "cert-scene",
    provider: providerId,
    prompt: "Certification test. A solid black screen.",
    cameraDirection: "static hold",
    duration: 5,
    referenceAssets: [{ path: referenceAsset.path, role: "sourceImage" }],
  };

  let jobId: string | undefined;
  const submitStep = await runStep("Submit Job", async () => {
    jobId = await adapter.submitJob("cert-project", dummyJob);
    if (!jobId || typeof jobId !== "string") {
      throw new Error("submitJob did not return a valid string ID.");
    }
    return { jobId };
  });
  steps.push(submitStep);

  if (submitStep.status === "failed" || !jobId) {
    return finish();
  }

  // Step 4: Lifecycle - Poll
  let completedJobResult: ProviderJobResult | undefined;
  const pollStep = await runStep("Poll Job Completion", async () => {
    const pollStart = Date.now();
    while (true) {
      if (Date.now() - pollStart > MAX_POLL_TIME_MS) {
        throw new Error("Polling timed out during certification.");
      }

      const result = await adapter.pollJob("cert-project", jobId!);
      if (result.status === "completed") {
        completedJobResult = result;
        return { completedAt: result.completedAt, videoId: result.placeholderVideoId };
      }
      if (result.status === "failed") {
        throw new Error(`Provider returned failed status: ${result.error}`);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  });
  steps.push(pollStep);

  // Step 5: Artifact Validation
  const artifactStep = await runStep("Artifact Validation", async () => {
    if (!completedJobResult) {
      throw new Error("No completed job result available — poll step may have failed.");
    }
    return await assertArtifactValid(providerId, "cert-project", completedJobResult);
  });
  steps.push(artifactStep);

  // Step 6: Cost Validation
  const costStep = await runStep("Cost Validation", async () => {
    const cost = adapter.estimateCost(dummyJob);
    if (typeof cost !== "number") throw new Error("estimateCost() must return a number.");
    return { estimatedCostUsd: cost };
  });
  steps.push(costStep);

  // Step 7: Cancellation Flow (Optional)
  const cancelStep = await runStep("Cancellation Flow", async () => {
    if (!adapter.cancelJob) {
      throw new Error("cancelJob is not implemented.");
    }
    const cancelJobRequest: ProviderJobRequest = {
      ...dummyJob,
      id: `cert-cancel-${Date.now()}`,
    };
    const cancelJobId = await adapter.submitJob("cert-project", cancelJobRequest);
    await adapter.cancelJob("cert-project", cancelJobId);
    return { canceledJobId: cancelJobId };
  });
  
  if (cancelStep.error === "cancelJob is not implemented.") {
    cancelStep.status = "skipped";
    cancelStep.error = undefined;
    cancelStep.details = { reason: "Provider adapter does not support cancellation." };
  }
  steps.push(cancelStep);

  return finish();
}

function finalizeReport(providerId: string, startTime: number, steps: CertificationStep[]): CertificationReport {
  const hasFailure = steps.some(s => s.status === "failed");
  return {
    provider: providerId,
    certifiedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    overallStatus: hasFailure ? "failed" : "passed",
    steps,
  };
}
