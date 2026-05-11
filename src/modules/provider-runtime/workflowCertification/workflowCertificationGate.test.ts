import { afterEach, describe, expect, it } from "vitest";

import { getProviderReadiness, inspectProviderPayload } from "../readiness";
import type { ProviderJobRequest } from "../types";
import {
  evaluateWorkflowCertificationGate,
  resetWorkflowCertificationRegistry,
  setProviderLifecycleStatus,
  setWorkflowCertificationState,
} from "./index";

const ORIGINAL_ENV = { ...process.env };

const comfyJob: ProviderJobRequest = {
  duration: 1,
  id: "job-1",
  prompt: "test",
  provider: "comfy",
  sceneId: "scene-1",
  workflowId: "flux-fast-concept",
};

describe("workflow certification gate", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetWorkflowCertificationRegistry();
  });

  it("blocks production execution when Comfy is lifecycle-certified but workflow timed out", () => {
    process.env.PROVIDER_RUNTIME_EXECUTION_MODE = "execute";
    process.env.PROVIDER_RUNTIME_ENABLE_COMFY = "true";
    process.env.COMFY_API_URL = "http://127.0.0.1:8188";

    const inspection = inspectProviderPayload(comfyJob);

    expect(inspection.providerLifecycleStatus).toBe("lifecycle_certified");
    expect(inspection.workflowCertificationStatus).toBe("timeout");
    expect(inspection.canExecute).toBe(false);
    expect(inspection.canExecuteWorkflow).toBe(false);
    expect(inspection.missingRequirements).toContain("workflow_production_certification");
  });

  it("allows Comfy execution only when lifecycle, workflow certification, execute mode, and enable flag are present", () => {
    setWorkflowCertificationState({
      provider: "comfy",
      status: "production_certified",
      workflowId: "flux-fast-concept",
    });
    process.env.PROVIDER_RUNTIME_EXECUTION_MODE = "execute";
    process.env.PROVIDER_RUNTIME_ENABLE_COMFY = "true";
    process.env.COMFY_API_URL = "http://127.0.0.1:8188";

    const inspection = inspectProviderPayload(comfyJob);

    expect(inspection.providerLifecycleStatus).toBe("lifecycle_certified");
    expect(inspection.workflowCertificationStatus).toBe("production_certified");
    expect(inspection.canExecute).toBe(true);
    expect(inspection.canExecuteWorkflow).toBe(true);
  });

  it("still blocks production-certified workflow when Comfy enable flag is false", () => {
    setWorkflowCertificationState({
      provider: "comfy",
      status: "production_certified",
      workflowId: "flux-fast-concept",
    });
    process.env.PROVIDER_RUNTIME_EXECUTION_MODE = "execute";
    process.env.COMFY_API_URL = "http://127.0.0.1:8188";

    const readiness = getProviderReadiness("comfy", comfyJob);

    expect(readiness.canExecute).toBe(false);
    expect(readiness.missingRequirements).toContain("PROVIDER_RUNTIME_ENABLE_COMFY");
  });

  it("smoke certification does not mark production workflow certified", () => {
    const gate = evaluateWorkflowCertificationGate("comfy", "flux-fast-concept");

    expect(gate.providerLifecycleStatus).toBe("lifecycle_certified");
    expect(gate.workflowCertificationStatus).toBe("timeout");
    expect(gate.canExecuteWorkflow).toBe(false);
  });

  it("workflow timeout remains isolated to that workflow", () => {
    const fast = evaluateWorkflowCertificationGate("comfy", "flux-fast-concept");
    const cinematic = evaluateWorkflowCertificationGate("comfy", "flux-dev-cinematic");

    expect(fast.workflowCertificationStatus).toBe("timeout");
    expect(fast.workflowState.classification).toBe("running_no_history");
    expect(cinematic.workflowCertificationStatus).toBe("uncertified");
    expect(cinematic.workflowState.classification).toBeUndefined();
  });

  it("WAN, Kling, and Runway remain disabled by lifecycle certification defaults", () => {
    for (const provider of ["wan", "kling", "runway"] as const) {
      const gate = evaluateWorkflowCertificationGate(provider, "future-workflow");
      expect(gate.providerLifecycleStatus).toBe("uncertified");
      expect(gate.canExecuteWorkflow).toBe(false);
    }
  });

  it("mock remains safe fallback", () => {
    const gate = evaluateWorkflowCertificationGate("mock", "mock");

    expect(gate.providerLifecycleStatus).toBe("lifecycle_certified");
    expect(gate.workflowCertificationStatus).toBe("production_certified");
    expect(gate.canExecuteWorkflow).toBe(true);
  });

  it("does not allow production execution when lifecycle certification is missing", () => {
    setProviderLifecycleStatus("comfy", "uncertified");
    setWorkflowCertificationState({
      provider: "comfy",
      status: "production_certified",
      workflowId: "flux-fast-concept",
    });

    const gate = evaluateWorkflowCertificationGate("comfy", "flux-fast-concept");

    expect(gate.canExecuteWorkflow).toBe(false);
    expect(gate.missingRequirements).toContain("provider_lifecycle_certification");
  });
});
