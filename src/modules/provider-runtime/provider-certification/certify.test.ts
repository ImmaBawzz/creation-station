import { describe, expect, it } from "vitest";

import { runCertification } from "./certify";

describe("provider certification harness", () => {
  it("certifies the mock provider without external calls", async () => {
    const report = await runCertification("mock");

    expect(report.provider).toBe("mock");
    expect(report.overallStatus).toBe("passed");
    expect(report.steps.map((step) => step.name)).toContain("Artifact Validation");
  });
});
