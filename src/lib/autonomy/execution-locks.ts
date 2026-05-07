export type ExecutionLockStatus = "active" | "expired" | "released";

export type ExecutionLockRecord = {
  acquiredAt: Date;
  expiresAt: Date;
  lockKey: string;
  owner: string;
  releasedAt: Date | null;
  runId: string | null;
  status: ExecutionLockStatus | string;
};

export type LockAcquireResult =
  | {
      acquired: true;
      lock: ExecutionLockRecord;
      reason: "created" | "expired_replaced" | "released_reused";
    }
  | {
      acquired: false;
      lock: ExecutionLockRecord;
      reason: "duplicate_active";
    };

export function isLockExpired(lock: Pick<ExecutionLockRecord, "expiresAt" | "status">, now: Date): boolean {
  return lock.status === "active" && new Date(lock.expiresAt).getTime() <= now.getTime();
}

export function buildExecutionLock({
  lockKey,
  now,
  owner,
  runId,
  ttlMs,
}: {
  lockKey: string;
  now: Date;
  owner: string;
  runId: string;
  ttlMs: number;
}): ExecutionLockRecord {
  return {
    acquiredAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
    lockKey,
    owner,
    releasedAt: null,
    runId,
    status: "active",
  };
}

export function resolveLockAcquire({
  existingLock,
  lockKey,
  now = new Date(),
  owner,
  runId,
  ttlMs = 15 * 60 * 1_000,
}: {
  existingLock?: ExecutionLockRecord | null;
  lockKey: string;
  now?: Date;
  owner: string;
  runId: string;
  ttlMs?: number;
}): LockAcquireResult {
  const nextLock = buildExecutionLock({ lockKey, now, owner, runId, ttlMs });

  if (!existingLock) {
    return {
      acquired: true,
      lock: nextLock,
      reason: "created",
    };
  }

  if (existingLock.status === "released") {
    return {
      acquired: true,
      lock: nextLock,
      reason: "released_reused",
    };
  }

  if (isLockExpired(existingLock, now)) {
    return {
      acquired: true,
      lock: nextLock,
      reason: "expired_replaced",
    };
  }

  return {
    acquired: false,
    lock: existingLock,
    reason: "duplicate_active",
  };
}
