"use client";

import { restoreBackup } from "./actions";

type BackupRestoreProps = {
  message?: string;
  status?: string;
};

export function BackupRestore({ message, status }: BackupRestoreProps) {
  const isError = status === "error";
  const hasMessage = Boolean(status && message);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Manual Backup And Restore</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Export a readable JSON backup or restore a previous Creation Station
            backup. This is local and manual only: no cloud sync, accounts, or
            external storage service is used.
          </p>
        </div>
        <a
          href="/api/export"
          className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Export Backup
        </a>
      </div>

      {hasMessage && (
        <div
          className={
            isError
              ? "mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"
              : "mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
          }
        >
          {message}
        </div>
      )}

      <form
        action={restoreBackup}
        className="mt-5 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
        onSubmit={(event) => {
          const confirmed = window.confirm(
            "Restore Workspace will replace all local ideas, project plans, tasks, and dependencies with the selected backup. Continue?",
          );

          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <div>
          <label className="text-sm font-semibold text-zinc-200" htmlFor="backup-file">
            Import Backup
          </label>
          <input
            id="backup-file"
            name="backupFile"
            type="file"
            accept="application/json,.json"
            required
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-100"
          />
        </div>

        <div>
          <label
            className="text-sm font-semibold text-zinc-200"
            htmlFor="restore-confirmation"
          >
            Restore Workspace
          </label>
          <p className="mt-1 text-sm text-zinc-500">
            Type <span className="font-semibold text-zinc-300">RESTORE</span> to
            confirm. Unknown backup fields are ignored, but invalid core records
            are rejected.
          </p>
          <input
            id="restore-confirmation"
            name="restoreConfirmation"
            placeholder="RESTORE"
            required
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
        </div>

        <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
          Restore Workspace
        </button>
      </form>
    </section>
  );
}
