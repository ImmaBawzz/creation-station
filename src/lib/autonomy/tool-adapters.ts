import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import {
  appendExecutionAuditLog,
  createExecutionAuditLogEntry,
  type ExecutionAuditLogEntry,
} from "@/lib/autonomy/execution-audit-log";
import {
  createFileRollbackSnapshot,
  type RollbackSnapshotDraft,
} from "@/lib/autonomy/rollback-manager";
import {
  capabilityViolationReason,
  type WorkspaceCapabilities,
} from "@/lib/autonomy/workspace-permissions";

const execFileAsync = promisify(execFile);

export type AdapterExecutionMode = "live" | "simulation";

export type AdapterResult = {
  auditLog: readonly ExecutionAuditLogEntry[];
  error: string | null;
  ok: boolean;
  output: string;
  rollbackId: string | null;
  snapshot?: RollbackSnapshotDraft;
};

export type AdapterContext = {
  actor: string;
  auditLog?: readonly ExecutionAuditLogEntry[];
  capabilities: WorkspaceCapabilities;
  mode: AdapterExecutionMode;
  workspaceRoot?: string;
};

export const WRITABLE_WORKSPACE_DIRECTORIES = [
  "output",
] as const;

export const TERMINAL_COMMAND_WHITELIST = [
  "npm run lint",
  "npm test",
  "npx tsc --noEmit",
  "npx prisma generate",
] as const;

const GIT_COMMAND_WHITELIST = ["commit", "diff", "status"] as const;

const dangerousCommandPattern =
  /\b(rm\s+-rf|remove-item\b.*\b-recurse\b|del\s+\/s|format\b|shutdown\b|git\s+reset\s+--hard|git\s+push\b.*\b--force|git\s+clean\b|drop\s+database|prisma\s+migrate|npm\s+install|pnpm\s+add|yarn\s+add)\b/i;
const protectedPathPattern = /(^|[\\/])(\.env|\.git|node_modules|dev\.db)($|[\\/])/i;

function result({
  action,
  actor,
  auditLog = [],
  error,
  output,
  rollbackId,
  status,
  snapshot,
}: {
  action: string;
  actor: string;
  auditLog?: readonly ExecutionAuditLogEntry[];
  error: string | null;
  output: string;
  rollbackId: string | null;
  snapshot?: RollbackSnapshotDraft;
  status: "blocked" | "failed" | "simulated" | "succeeded";
}): AdapterResult {
  return {
    auditLog: appendExecutionAuditLog(
      auditLog,
      createExecutionAuditLogEntry({
        action,
        actor,
        result: status,
        rollbackId,
      }),
    ),
    error,
    ok: status === "simulated" || status === "succeeded",
    output,
    rollbackId,
    snapshot,
  };
}

function normalizeRelativePath(targetPath: string): string {
  return targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveWorkspacePath({
  targetPath,
  workspaceRoot = process.cwd(),
}: {
  targetPath: string;
  workspaceRoot?: string;
}): { absolutePath: string; relativePath: string } {
  const relativePath = normalizeRelativePath(targetPath);
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ workspaceRoot, relativePath);
  const root = path.resolve(/*turbopackIgnore: true*/ workspaceRoot);

  if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
    throw new Error("Path must stay inside the workspace.");
  }

  if (relativePath.includes("../") || relativePath.includes("..\\")) {
    throw new Error("Path traversal is not allowed.");
  }

  if (protectedPathPattern.test(relativePath)) {
    throw new Error("Protected paths, secrets, dependencies, and databases are blocked.");
  }

  return { absolutePath, relativePath };
}

function assertWritablePath(relativePath: string): void {
  const allowed = WRITABLE_WORKSPACE_DIRECTORIES.some(
    (directory) => relativePath === directory || relativePath.startsWith(`${directory}/`),
  );

  if (!allowed) {
    throw new Error("Writable path is outside the allowed adapter directories.");
  }
}

function splitWhitelistedCommand(command: string): { executable: string; args: string[] } {
  const normalized = command.trim().replace(/\s+/g, " ");

  if (dangerousCommandPattern.test(normalized)) {
    throw new Error("Dangerous terminal command is blocked.");
  }

  if (!TERMINAL_COMMAND_WHITELIST.includes(normalized as (typeof TERMINAL_COMMAND_WHITELIST)[number])) {
    throw new Error("Terminal command is not whitelisted.");
  }

  const [executable, ...args] = normalized.split(" ");
  return { executable, args };
}

function gitExecutable(): string {
  return process.platform === "win32" ? "git.exe" : "git";
}

export async function runFileAdapter({
  content,
  context,
  operation,
  targetPath,
}: {
  content?: string;
  context: AdapterContext;
  operation: "read" | "restore" | "write";
  targetPath: string;
}): Promise<AdapterResult> {
  const action = `file.${operation}:${targetPath}`;

  try {
    const { absolutePath, relativePath } = resolveWorkspacePath({
      targetPath,
      workspaceRoot: context.workspaceRoot,
    });

    if (operation === "read") {
      if (context.mode === "simulation") {
        return result({
          action,
          actor: context.actor,
          auditLog: context.auditLog,
          error: null,
          output: `Would read ${relativePath}.`,
          rollbackId: null,
          status: "simulated",
        });
      }

      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: null,
        output: readFileSync(absolutePath, "utf8"),
        rollbackId: null,
        status: "succeeded",
      });
    }

    const capabilityError = capabilityViolationReason({
      actionType: "file_write",
      capabilities: context.capabilities,
    });

    if (capabilityError) {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: capabilityError,
        output: "",
        rollbackId: null,
        status: "blocked",
      });
    }

    assertWritablePath(relativePath);

    if (operation === "restore") {
      if (content === undefined) {
        throw new Error("Restore content is required.");
      }

      if (context.mode === "live") {
        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, content, "utf8");
      }

      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: null,
        output: context.mode === "live" ? `Restored ${relativePath}.` : `Would restore ${relativePath}.`,
        rollbackId: `restore:${relativePath}`,
        status: context.mode === "live" ? "succeeded" : "simulated",
      });
    }

    if (content === undefined) {
      throw new Error("Write content is required.");
    }

    const snapshot = existsSync(absolutePath)
      ? createFileRollbackSnapshot({
          content: readFileSync(absolutePath, "utf8"),
          path: relativePath,
        })
      : createFileRollbackSnapshot({
          content: "",
          path: relativePath,
        });
    const rollbackId = snapshot.restoreReference;

    if (context.mode === "simulation") {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: null,
        output: `Would snapshot and write ${relativePath}.`,
        rollbackId,
        snapshot,
        status: "simulated",
      });
    }

    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");

    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: null,
      output: `Wrote ${relativePath}.`,
      rollbackId,
      snapshot,
      status: "succeeded",
    });
  } catch (error) {
    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: error instanceof Error ? error.message : "File adapter failed.",
      output: "",
      rollbackId: null,
      status: "failed",
    });
  }
}

export async function restoreFileRollbackSnapshot({
  context,
  snapshot,
}: {
  context: AdapterContext;
  snapshot: RollbackSnapshotDraft;
}): Promise<AdapterResult> {
  if (snapshot.kind !== "file" || !snapshot.targetPath) {
    return result({
      action: "file.restore:invalid-snapshot",
      actor: context.actor,
      auditLog: context.auditLog,
      error: "File rollback snapshot is required.",
      output: "",
      rollbackId: null,
      status: "blocked",
    });
  }

  if (snapshot.content === "") {
    const { absolutePath, relativePath } = resolveWorkspacePath({
      targetPath: snapshot.targetPath,
      workspaceRoot: context.workspaceRoot,
    });
    assertWritablePath(relativePath);

    if (context.mode === "live" && existsSync(absolutePath)) {
      rmSync(absolutePath);
    }

    return result({
      action: `file.restore:${snapshot.targetPath}`,
      actor: context.actor,
      auditLog: context.auditLog,
      error: null,
      output: context.mode === "live" ? `Removed created file ${relativePath}.` : `Would remove ${relativePath}.`,
      rollbackId: snapshot.restoreReference,
      status: context.mode === "live" ? "succeeded" : "simulated",
    });
  }

  return runFileAdapter({
    content: snapshot.content,
    context,
    operation: "restore",
    targetPath: snapshot.targetPath,
  });
}

export async function runTerminalAdapter({
  command,
  context,
  timeoutMs = 10_000,
}: {
  command: string;
  context: AdapterContext;
  timeoutMs?: number;
}): Promise<AdapterResult> {
  const action = `terminal:${command}`;

  try {
    const capabilityError = capabilityViolationReason({
      actionType: "terminal_command",
      capabilities: context.capabilities,
    });

    if (capabilityError) {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: capabilityError,
        output: "",
        rollbackId: null,
        status: "blocked",
      });
    }

    const { executable, args } = splitWhitelistedCommand(command);

    if (context.mode === "simulation") {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: null,
        output: `Would run ${command}.`,
        rollbackId: null,
        status: "simulated",
      });
    }

    const { stderr, stdout } = await execFileAsync(executable, args, {
      cwd: context.workspaceRoot ?? process.cwd(),
      timeout: timeoutMs,
      windowsHide: true,
    });

    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: null,
      output: `${stdout}${stderr}`.trim(),
      rollbackId: null,
      status: "succeeded",
    });
  } catch (error) {
    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: error instanceof Error ? error.message : "Terminal adapter failed.",
      output: "",
      rollbackId: null,
      status: "failed",
    });
  }
}

export async function runGitAdapter({
  context,
  message,
  operation,
}: {
  context: AdapterContext;
  message?: string;
  operation: (typeof GIT_COMMAND_WHITELIST)[number];
}): Promise<AdapterResult> {
  const action = `git.${operation}`;

  try {
    const capabilityError = capabilityViolationReason({
      actionType: "git_commit",
      capabilities: context.capabilities,
    });

    if (capabilityError) {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: capabilityError,
        output: "",
        rollbackId: null,
        status: "blocked",
      });
    }

    if (!GIT_COMMAND_WHITELIST.includes(operation)) {
      throw new Error("Git operation is not whitelisted.");
    }

    if (operation === "commit" && (!message || /\b(--amend|--no-verify|reset|force)\b/i.test(message))) {
      throw new Error("Git commit message is missing or requests unsafe behavior.");
    }

    const args =
      operation === "status"
        ? ["status", "--short"]
        : operation === "diff"
          ? ["diff", "--stat"]
          : ["commit", "-m", message ?? ""];
    const rollbackId = operation === "commit" ? `git-revert:${Date.now()}` : null;

    if (context.mode === "simulation") {
      return result({
        action,
        actor: context.actor,
        auditLog: context.auditLog,
        error: null,
        output: `Would run git ${args.join(" ")}.`,
        rollbackId,
        status: "simulated",
      });
    }

    const { stderr, stdout } = await execFileAsync(gitExecutable(), args, {
      cwd: context.workspaceRoot ?? process.cwd(),
      timeout: 10_000,
      windowsHide: true,
    });

    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: null,
      output: `${stdout}${stderr}`.trim(),
      rollbackId,
      status: "succeeded",
    });
  } catch (error) {
    return result({
      action,
      actor: context.actor,
      auditLog: context.auditLog,
      error: error instanceof Error ? error.message : "Git adapter failed.",
      output: "",
      rollbackId: null,
      status: "failed",
    });
  }
}

export function buildToolAdapterPreview(): {
  auditLog: readonly ExecutionAuditLogEntry[];
  commandWhitelist: readonly string[];
  mode: AdapterExecutionMode;
  writableDirectories: readonly string[];
} {
  const auditLog = appendExecutionAuditLog(
    [],
    createExecutionAuditLogEntry({
      action: "adapter.preview",
      actor: "creation-station-ui",
      result: "simulated",
      rollbackId: null,
    }),
  );

  return {
    auditLog,
    commandWhitelist: TERMINAL_COMMAND_WHITELIST,
    mode: "simulation",
    writableDirectories: WRITABLE_WORKSPACE_DIRECTORIES,
  };
}
