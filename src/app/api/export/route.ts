import { logActivity } from "@/lib/activity-log";
import { logAnalyticsEvent } from "@/lib/analytics";
import { backupFilename, buildWorkspaceBackup } from "@/lib/backup";

export async function GET() {
  const backup = await buildWorkspaceBackup();

  await logAnalyticsEvent("backup_exported", {
    ideas: backup.ideas.length,
    projects: backup.projects.length,
    tasks: backup.tasks.length,
  });

  await logActivity({
    entityType: "workspace",
    eventType: "backup_exported",
    metadata: {
      ideas: backup.ideas.length,
      projects: backup.projects.length,
      tasks: backup.tasks.length,
      title: "Workspace backup",
    },
  });

  return Response.json(backup, {
    headers: {
      "Content-Disposition": `attachment; filename="${backupFilename(backup.exportedAt)}"`,
    },
  });
}
