import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { runCertification } from "./certify";
import type { ProviderType } from "../types";
import { writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args[0];

  if (!providerArg) {
    console.error("Usage: npm run certify:provider <providerId>");
    console.error("Example: npm run certify:provider mock");
    process.exit(1);
  }

  const providerId = providerArg as ProviderType;

  console.log(`\n=================================================`);
  console.log(`  Starting Certification Pipeline: [${providerId.toUpperCase()}]`);
  console.log(`=================================================\n`);

  const report = await runCertification(providerId);

  console.log(`\n=================================================`);
  console.log(`  Certification Result: ${report.overallStatus.toUpperCase()}`);
  console.log(`  Duration: ${(report.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`=================================================\n`);

  for (const step of report.steps) {
    const icon = step.status === "passed" ? "PASS" : step.status === "failed" ? "FAIL" : "SKIP";
    console.log(`${icon} [${step.status.toUpperCase()}] ${step.name} (${(step.durationMs / 1000).toFixed(2)}s)`);
    if (step.error) {
      console.log(`    Error: ${step.error}`);
    }
    if (step.details) {
      console.log("    Details:", step.details);
    }
  }

  const outDir = path.join(process.cwd(), "docs");
  const outFile = path.join(outDir, `certification-${providerId}.json`);
  
  await writeFile(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nSaved detailed report to: docs/certification-${providerId}.json\n`);

  if (report.overallStatus === "failed") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running certification:", err);
  process.exit(1);
});
