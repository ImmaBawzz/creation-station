import { describe, expect, it } from "vitest";

import {
  buildWorkflowStateSnapshot,
  validateStateFreshness,
} from "@/lib/autonomy/state-freshness";

function snapshot(status: string) {
  return buildWorkflowStateSnapshot({
    files: [],
    plans: [
      {
        id: "plan-a",
        status: "REVIEW_PENDING",
        updatedAt: "2026-05-07T12:00:00.000Z",
      },
    ],
    tasks: [
      {
        blockers: [],
        id: "task-a",
        planId: "plan-a",
        status,
        updatedAt: "2026-05-07T12:00:00.000Z",
      },
    ],
  });
}

describe("state freshness", () => {
  it("passes when the latest file and task state matches the planned snapshot", () => {
    const planned = snapshot("TODO");

    expect(
      validateStateFreshness({
        expectedHash: planned.hash,
        latestSnapshot: snapshot("TODO"),
      }),
    ).toMatchObject({ status: "fresh", staleReason: "" });
  });

  it("blocks stale execution when task state changed after planning", () => {
    const planned = snapshot("TODO");
    const latest = snapshot("DONE");

    expect(
      validateStateFreshness({
        expectedHash: planned.hash,
        latestSnapshot: latest,
      }),
    ).toMatchObject({ status: "stale" });
  });
});
