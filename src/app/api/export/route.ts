import { db } from "@/lib/db";
import packageJson from "../../../../package.json";

function backupFilename(generatedAt: string): string {
  return `creation-station-backup-${generatedAt.replace(/[:.]/g, "-")}.json`;
}

export async function GET() {
  const generatedAt = new Date().toISOString();

  const [ideas, factoryPlans, tasks] = await Promise.all([
    db.idea.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.factoryPlan.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const backup = {
    generatedAt,
    appVersion: packageJson.version,
    ideas,
    factoryPlans,
    tasks,
  };

  return Response.json(backup, {
    headers: {
      "Content-Disposition": `attachment; filename="${backupFilename(generatedAt)}"`,
    },
  });
}
