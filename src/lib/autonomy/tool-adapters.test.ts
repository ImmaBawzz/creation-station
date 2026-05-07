import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  restoreFileRollbackSnapshot,
  runFileAdapter,
  runTerminalAdapter,
} from "@/lib/autonomy/tool-adapters";
import type { WorkspaceCapabilities } from "@/lib/autonomy/workspace-permissions";

function capabilities(overrides: Partial<WorkspaceCapabilities> = {}): WorkspaceCapabilities {
  return {
    canDeploy: false,
    canRunCommands: false,
    canUseExternalApis: false,
    canUseGit: false,
    canWriteFiles: false,
    ...overrides,
  };
}

function tempWorkspace(): string {
  return mkdtempSync(path.join(os.tmpdir(), "creation-station-adapter-"));
}

describe("real tool adapter layer", () => {
  it("blocks file writes when workspace write permission is missing", async () => {
    const root = tempWorkspace();

    try {
      const result = await runFileAdapter({
        content: "blocked",
        context: {
          actor: "test",
          capabilities: capabilities(),
          mode: "live",
          workspaceRoot: root,
        },
        operation: "write",
        targetPath: "output/blocked.txt",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("canWriteFiles");
      expect(result.auditLog[0]).toMatchObject({ result: "blocked" });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("blocks dangerous terminal commands before execution", async () => {
    const result = await runTerminalAdapter({
      command: "git reset --hard HEAD",
      context: {
        actor: "test",
        capabilities: capabilities({ canRunCommands: true }),
        mode: "live",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Dangerous terminal command is blocked.");
    expect(result.auditLog[0]).toMatchObject({ result: "failed" });
  });

  it("restores a file rollback snapshot after a live write", async () => {
    const root = tempWorkspace();
    const targetDir = path.join(root, "output");
    const target = path.join(targetDir, "rollback.txt");

    try {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(target, "before", "utf8");

      const writeResult = await runFileAdapter({
        content: "after",
        context: {
          actor: "test",
          capabilities: capabilities({ canWriteFiles: true }),
          mode: "live",
          workspaceRoot: root,
        },
        operation: "write",
        targetPath: "output/rollback.txt",
      });

      expect(writeResult.ok).toBe(true);
      expect(readFileSync(target, "utf8")).toBe("after");
      expect(writeResult.snapshot?.content).toBe("before");

      const restoreResult = await restoreFileRollbackSnapshot({
        context: {
          actor: "test",
          capabilities: capabilities({ canWriteFiles: true }),
          mode: "live",
          workspaceRoot: root,
        },
        snapshot: writeResult.snapshot!,
      });

      expect(restoreResult.ok).toBe(true);
      expect(readFileSync(target, "utf8")).toBe("before");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("fails adapter writes outside allowed directories", async () => {
    const root = tempWorkspace();

    try {
      const result = await runFileAdapter({
        content: "unsafe",
        context: {
          actor: "test",
          capabilities: capabilities({ canWriteFiles: true }),
          mode: "live",
          workspaceRoot: root,
        },
        operation: "write",
        targetPath: "src/app/page.tsx",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Writable path is outside the allowed adapter directories.");
      expect(result.auditLog[0]).toMatchObject({ result: "failed" });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
