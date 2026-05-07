import { describe, expect, it } from "vitest";

import { resolveLockAcquire } from "@/lib/autonomy/execution-locks";

describe("execution locks", () => {
  it("blocks duplicate execution attempts while an active lock has not expired", () => {
    const now = new Date("2026-05-07T12:00:00.000Z");
    const first = resolveLockAcquire({
      lockKey: "execution:plan-a:state-a",
      now,
      owner: "test",
      runId: "run-a",
    });
    const duplicate = resolveLockAcquire({
      existingLock: first.lock,
      lockKey: "execution:plan-a:state-a",
      now: new Date("2026-05-07T12:01:00.000Z"),
      owner: "test",
      runId: "run-b",
    });

    expect(first.acquired).toBe(true);
    expect(duplicate.acquired).toBe(false);
    expect(duplicate.reason).toBe("duplicate_active");
    expect(duplicate.lock.runId).toBe("run-a");
  });

  it("allows a new run to acquire a lock after TTL expiration", () => {
    const first = resolveLockAcquire({
      lockKey: "execution:plan-a:state-a",
      now: new Date("2026-05-07T12:00:00.000Z"),
      owner: "test",
      runId: "run-a",
      ttlMs: 60_000,
    });
    const afterTtl = resolveLockAcquire({
      existingLock: first.lock,
      lockKey: "execution:plan-a:state-a",
      now: new Date("2026-05-07T12:01:01.000Z"),
      owner: "test",
      runId: "run-b",
      ttlMs: 60_000,
    });

    expect(afterTtl.acquired).toBe(true);
    expect(afterTtl.reason).toBe("expired_replaced");
    expect(afterTtl.lock.runId).toBe("run-b");
  });
});
