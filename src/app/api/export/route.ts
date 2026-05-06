import { logAnalyticsEvent } from "@/lib/analytics";
import { backupFilename, buildWorkspaceBackup } from "@/lib/backup";

export async function GET() {
  const backup = await buildWorkspaceBackup();

  await logAnalyticsEvent("backup_exported", {
    ideas: backup.ideas.length,
    projects: backup.projects.length,
    tasks: backup.tasks.length,
  });

  return Response.json(backup, {
    headers: {
      "Content-Disposition": `attachment; filename="${backupFilename(backup.exportedAt)}"`,
    },
  });
}
