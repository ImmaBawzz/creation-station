import { logActivity } from "@/lib/activity-log";
import { logAnalyticsEvent } from "@/lib/analytics";
import { backupFilename, buildWorkspaceBackup } from "@/lib/backup";

export async function GET() {
  const backup = await buildWorkspaceBackup();

  await logAnalyticsEvent("backup_exported", {
    contentItems: backup.contentItems.length,
    ideas: backup.ideas.length,
    projects: backup.projects.length,
    tasks: backup.tasks.length,
  });

  await logActivity({
    entityType: "workspace",
    eventType: "backup_exported",
    metadata: {
      contentItems: backup.contentItems.length,
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
