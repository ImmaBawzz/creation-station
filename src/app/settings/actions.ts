"use server";

import { testAiProviderConnection } from "@/lib/aiProvider";
import { logAnalyticsEvent } from "@/lib/analytics";
import { restoreWorkspaceBackup } from "@/lib/backup";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function testAiConnection() {
  const result = await testAiProviderConnection();
  const params = new URLSearchParams({
    aiHealth: result.ok ? "ok" : "error",
    aiMessage: result.message,
  });

  redirect(`/settings?${params.toString()}`);
}

function backupRedirect(status: "error" | "ok", message: string): never {
  const params = new URLSearchParams({
    backupMessage: message,
    backupStatus: status,
  });

  redirect(`/settings?${params.toString()}`);
}

export async function restoreBackup(formData: FormData) {
  const confirmation = formData.get("restoreConfirmation");
  const backupFile = formData.get("backupFile");

  if (confirmation !== "RESTORE") {
    backupRedirect("error", "Type RESTORE before importing a backup.");
  }

  if (!(backupFile instanceof File) || backupFile.size === 0) {
    backupRedirect("error", "Choose a Creation Station JSON backup file first.");
  }

  try {
    const rawBackup = JSON.parse(await backupFile.text());
    await restoreWorkspaceBackup(rawBackup);
    await logAnalyticsEvent("backup_imported", {
      filename: backupFile.name,
      size: backupFile.size,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Backup could not be restored.";

    backupRedirect("error", message);
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/factory");
  revalidatePath("/settings");
  backupRedirect("ok", "Workspace restored from backup. Reload other open tabs.");
}
