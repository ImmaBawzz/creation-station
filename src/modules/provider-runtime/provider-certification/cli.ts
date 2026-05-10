import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { runComfyCertification } from "./comfyCertification";
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

  const report = providerId === "comfy"
    ? await runComfyCertification()
    : await runCertification(providerId);
  const status = "overallStatus" in report ? report.overallStatus : report.finalStatus;
  const durationSeconds = "totalDurationMs" in report ? (report.totalDurationMs / 1000).toFixed(2) : "0.00";

  console.log(`\n=================================================`);
  console.log(`  Certification Result: ${status.toUpperCase()}`);
  console.log(`  Duration: ${durationSeconds}s`);
  console.log(`=================================================\n`);

  const rows = "steps" in report ? report.steps : report.phases.map((phase) => ({
    details: phase.details,
    durationMs: 0,
    error: phase.error,
    name: phase.name,
    status: phase.status,
  }));

  for (const row of rows) {
    const icon = row.status === "passed" ? "PASS" : row.status === "failed" ? "FAIL" : "SKIP";
    console.log(`${icon} [${row.status.toUpperCase()}] ${row.name} (${(row.durationMs / 1000).toFixed(2)}s)`);
    if (row.error) {
      console.log(`    Error: ${row.error}`);
    }
    if (row.details) {
      console.log("    Details:", row.details);
    }
  }

  const outDir = path.join(process.cwd(), "docs");
  const outFile = path.join(outDir, `certification-${providerId}.json`);
  
  await writeFile(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nSaved detailed report to: docs/certification-${providerId}.json\n`);

  const failed = status === "failed";

  if (failed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running certification:", err);
  process.exit(1);
});
