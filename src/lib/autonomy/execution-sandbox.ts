import {
  getActionRegistryEntry,
  type ActionRegistryEntry,
  type RegisteredActionType,
} from "@/lib/autonomy/action-registry";

export type ExecutionActionRequest = {
  id: string;
  type: RegisteredActionType | string;
  payload: unknown;
  expectedStateHash?: string;
};

export type SandboxValidation = {
  action: ActionRegistryEntry | null;
  blocked: boolean;
  malformed: boolean;
  reasons: string[];
  simulatedEffects: string[];
};

const dangerousShellPattern =
  /\b(rm\s+-rf|remove-item\b.*\b-recurse\b|del\s+\/s|format\b|shutdown\b|git\s+reset\s+--hard|git\s+push\b.*\b--force|drop\s+database|prisma\s+migrate|npm\s+install|pnpm\s+add|yarn\s+add)\b/i;
const secretPathPattern = /(^|[\\/])(\.env|\.git|node_modules|dev\.db)($|[\\/])/i;
const protectedPathPattern = /(^|[\\/])prisma[\\/]migrations($|[\\/])|(^|[\\/])prisma[\\/]schema\.prisma$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  return typeof value === "string" ? value.trim() : "";
}

function hasTraversal(value: string): boolean {
  return value.includes("../") || value.includes("..\\");
}

function validatePathPayload(payload: Record<string, unknown>, reasons: string[]): string {
  const targetPath = stringField(payload, "path");

  if (!targetPath) {
    reasons.push("Path is required.");
    return "";
  }

  if (hasTraversal(targetPath)) {
    reasons.push("Path traversal is not allowed.");
  }

  if (secretPathPattern.test(targetPath) || protectedPathPattern.test(targetPath)) {
    reasons.push("Protected paths, secrets, dependencies, migrations, and databases are blocked.");
  }

  return targetPath;
}

function validateUrlPayload(payload: Record<string, unknown>, reasons: string[]): string {
  const url = stringField(payload, "url");

  if (!url) {
    reasons.push("URL is required.");
    return "";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      reasons.push("Only http and https URLs are allowed.");
    }
  } catch {
    reasons.push("URL must be valid.");
  }

  return url;
}

function validateActionPayload(
  request: ExecutionActionRequest,
  payload: Record<string, unknown>,
  reasons: string[],
): string[] {
  if (request.type === "file_read") {
    const targetPath = validatePathPayload(payload, reasons);
    return targetPath ? [`Would read ${targetPath} without mutation.`] : [];
  }

  if (request.type === "file_write") {
    const targetPath = validatePathPayload(payload, reasons);
    const content = stringField(payload, "content");
    if (!content) {
      reasons.push("Content is required for file_write.");
    }
    return targetPath ? [`Would snapshot then write ${targetPath}.`] : [];
  }

  if (request.type === "terminal_command") {
    const command = stringField(payload, "command");
    if (!command) {
      reasons.push("Command is required.");
      return [];
    }

    if (dangerousShellPattern.test(command)) {
      reasons.push("Dangerous terminal payload is blocked.");
    }

    return [`Would reserve a manual shell execution slot for: ${command}`];
  }

  if (request.type === "browser_open") {
    const url = validateUrlPayload(payload, reasons);
    return url ? [`Would open browser target ${url}.`] : [];
  }

  if (request.type === "api_request") {
    const url = validateUrlPayload(payload, reasons);
    const method = stringField(payload, "method").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      reasons.push("API method must be GET, POST, PUT, PATCH, or DELETE.");
    }
    if (
      isPlainObject(payload.headers) &&
      Object.keys(payload.headers).some((header) => header.toLowerCase() === "authorization")
    ) {
      reasons.push("Authorization headers are blocked from action payload previews.");
    }
    return url && method ? [`Would prepare ${method} request to ${url}.`] : [];
  }

  if (request.type === "git_commit") {
    const message = stringField(payload, "message");
    if (!message) {
      reasons.push("Commit message is required.");
    }
    if (/\b(--amend|--no-verify)\b/i.test(message)) {
      reasons.push("Commit messages may not request amend or no-verify behavior.");
    }
    return message ? [`Would stage reviewed files and create commit: ${message}`] : [];
  }

  return [];
}

export function validateExecutionAction(request: Partial<ExecutionActionRequest>): SandboxValidation {
  const reasons: string[] = [];

  if (!request.id || typeof request.id !== "string") {
    reasons.push("Action id is required.");
  }

  if (!request.type || typeof request.type !== "string") {
    reasons.push("Action type is required.");
  }

  const action = request.type ? getActionRegistryEntry(request.type) : null;
  if (request.type && !action) {
    reasons.push(`Unknown action type ${request.type}.`);
  }

  if (!isPlainObject(request.payload)) {
    reasons.push("Payload must be a plain object.");
  }

  const simulatedEffects =
    action && isPlainObject(request.payload)
      ? validateActionPayload(request as ExecutionActionRequest, request.payload, reasons)
      : [];

  return {
    action,
    blocked: reasons.length > 0,
    malformed: reasons.some((reason) =>
      [
        "Action id is required.",
        "Action type is required.",
        "Payload must be a plain object.",
      ].includes(reason),
    ),
    reasons,
    simulatedEffects,
  };
}
