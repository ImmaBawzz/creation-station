import { describe, expect, it } from "vitest";

import { evaluateEscalations, hasBlockingEscalation } from "@/modules/regeneration-governor/escalationRules";
import { evaluateCostProtection, estimateCostUnits } from "@/modules/regeneration-governor/costProtector";
import { buildAllFallbacks, decideFallback } from "@/modules/regeneration-governor/fallbackDecision";
import { buildFailureMemory, getSceneFailureRecord, recordProviderAttempt } from "@/modules/regeneration-governor/failureMemory";
import { getTopPatterns, isKnownRecurringPattern } from "@/modules/regeneration-governor/patternMemory";
import { generatePreventionRecommendations } from "@/modules/regeneration-governor/preventionRecommendations";
import { extractPromptFailures, isUnstablePromptPhrase } from "@/modules/regeneration-governor/promptFailurePatterns";
import { calculateProviderScores, getBestProvider, getUnreliableProviders } from "@/modules/regeneration-governor/providerScoring";
import { buildAllStrategies } from "@/modules/regeneration-governor/regenerationStrategy";
import { checkProjectRetryBudget, checkSceneRetryLimit, getAllSceneLimits } from "@/modules/regeneration-governor/retryLimiter";
import { extractVisualFailures } from "@/modules/regeneration-governor/visualFailurePatterns";
import type { GlobalPatternMemory, ProjectFailureSummary, SceneRegenerationStrategy } from "@/modules/regeneration-governor/types";
import type { QualityIssue } from "@/modules/quality-director/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeIssue(overrides?: Partial<QualityIssue>): QualityIssue {
  return {
    evaluator: "visual-consistency",
    message: "Fallback image used for scene-002",
    recommendation: "Regenerate scene-002 video clip.",
    sceneId: "scene-002",
    severity: "warning",
    ...overrides,
  };
}

function makeMemory(overrides?: Partial<ProjectFailureSummary>): ProjectFailureSummary {
  return {
    firstAttemptAt: "2026-01-01T00:00:00Z",
    lastAttemptAt: "2026-01-01T00:00:00Z",
    projectId: "proj-001",
    sceneRecords: [],
    totalProjectAttempts: 0,
    ...overrides,
  };
}

function makeGlobalMemory(overrides?: Partial<GlobalPatternMemory>): GlobalPatternMemory {
  return {
    createdAt: "2026-01-01T00:00:00Z",
    failurePatterns: [],
    promptFailures: [],
    providerScores: [],
    updatedAt: "2026-01-01T00:00:00Z",
    version: 1,
    visualFailures: [],
    ...overrides,
  };
}

// ── failureMemory ────────────────────────────────────────────────────────────

describe("failureMemory", () => {
  it("creates a scene record on first failure", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    const memory = buildFailureMemory("proj-001", issues);

    expect(memory.sceneRecords).toHaveLength(1);
    expect(memory.sceneRecords[0].sceneId).toBe("scene-001");
    expect(memory.sceneRecords[0].totalAttempts).toBe(1);
    expect(memory.totalProjectAttempts).toBe(1);
  });

  it("accumulates attempts across calls", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    const first = buildFailureMemory("proj-001", issues);
    const second = buildFailureMemory("proj-001", issues, first);

    expect(second.sceneRecords[0].totalAttempts).toBe(2);
    expect(second.totalProjectAttempts).toBe(2);
  });

  it("detects recurring issue kinds after two attempts", () => {
    const issues = [makeIssue({ evaluator: "visual-consistency", sceneId: "scene-001", severity: "warning" })];
    const first = buildFailureMemory("proj-001", issues);
    const second = buildFailureMemory("proj-001", issues, first);
    const record = second.sceneRecords[0];

    expect(record.recurringIssueKinds).toContain("visual-consistency-issue");
  });

  it("skips info-severity issues", () => {
    const issues = [makeIssue({ severity: "info" })];
    const memory = buildFailureMemory("proj-001", issues);

    expect(memory.sceneRecords).toHaveLength(0);
    expect(memory.totalProjectAttempts).toBe(0);
  });

  it("returns null for unknown scene from getSceneFailureRecord", () => {
    const memory = makeMemory();
    const result = getSceneFailureRecord(memory, "unknown-scene");

    expect(result).toBeNull();
  });

  it("records provider attempts", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    const memory = buildFailureMemory("proj-001", issues);
    const updated = recordProviderAttempt(memory, "scene-001", "mock-hq");

    expect(updated.sceneRecords[0].providersTried).toContain("mock-hq");
    expect(updated.sceneRecords[0].providersTriedCount).toBe(1);
  });

  it("does not duplicate providers in providersTried", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = recordProviderAttempt(memory, "scene-001", "mock-hq");
    memory = recordProviderAttempt(memory, "scene-001", "mock-hq");

    expect(memory.sceneRecords[0].providersTried).toHaveLength(1);
  });
});

// ── retryLimiter ─────────────────────────────────────────────────────────────

describe("retryLimiter", () => {
  it("allows retry when under limit", () => {
    const memory = makeMemory();
    const status = checkSceneRetryLimit(memory, "scene-001", 3);

    expect(status.allowRetry).toBe(true);
    expect(status.attemptsUsed).toBe(0);
    expect(status.remainingAttempts).toBe(3);
  });

  it("denies retry when limit reached", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = buildFailureMemory("proj-001", issues, memory);
    memory = buildFailureMemory("proj-001", issues, memory);

    const status = checkSceneRetryLimit(memory, "scene-001", 3);

    expect(status.allowRetry).toBe(false);
    expect(status.hardLimitReached).toBe(true);
    expect(status.remainingAttempts).toBe(0);
  });

  it("checks project budget", () => {
    const memory = makeMemory({ totalProjectAttempts: 20 });
    const status = checkProjectRetryBudget(memory, 15);

    expect(status.allowFurtherRetries).toBe(false);
  });

  it("returns limits for all scene records", () => {
    const issues = [
      makeIssue({ sceneId: "scene-001", severity: "warning" }),
      makeIssue({ sceneId: "scene-002", severity: "warning" }),
    ];
    const memory = buildFailureMemory("proj-001", issues);
    const limits = getAllSceneLimits(memory, 3);

    expect(limits).toHaveLength(2);
    expect(limits.every((l) => l.allowRetry)).toBe(true);
  });
});

// ── escalationRules ───────────────────────────────────────────────────────────

describe("escalationRules", () => {
  it("recommends retry-same on first failure", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "warning" })];
    const memory = buildFailureMemory("proj-001", issues);
    const escalations = evaluateEscalations(memory, 3);
    const decision = escalations.find((e) => e.sceneId === "scene-001");

    expect(decision?.escalationLevel).toBe("retry-same");
  });

  it("recommends swap-provider after recurring failures with provider tried", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = recordProviderAttempt(memory, "scene-001", "mock");
    memory = buildFailureMemory("proj-001", issues, memory);
    memory = recordProviderAttempt(memory, "scene-001", "mock");

    // Use maxAttempts=3; with 2 attempts and a provider already tried, swap fires before human-review
    const escalations = evaluateEscalations(memory, 3);
    const decision = escalations.find((e) => e.sceneId === "scene-001");

    expect(decision?.escalationLevel).toBe("swap-provider");
    expect(decision?.suggestedNextProvider).toBeDefined();
  });

  it("recommends hard-stop at max attempts", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = buildFailureMemory("proj-001", issues, memory);
    memory = buildFailureMemory("proj-001", issues, memory);

    const escalations = evaluateEscalations(memory, 3);
    const decision = escalations.find((e) => e.sceneId === "scene-001");

    expect(decision?.escalationLevel).toBe("hard-stop");
  });

  it("detects blocking escalations", () => {
    const escalations = [
      { escalationLevel: "flag-human-review" as const, reason: "test", sceneId: "s1" },
    ];
    expect(hasBlockingEscalation(escalations)).toBe(true);
  });

  it("reports no blocking for retry-same", () => {
    const escalations = [
      { escalationLevel: "retry-same" as const, reason: "test", sceneId: "s1" },
    ];
    expect(hasBlockingEscalation(escalations)).toBe(false);
  });
});

// ── costProtector ─────────────────────────────────────────────────────────────

describe("costProtector", () => {
  it("returns zero cost for no failures", () => {
    const memory = makeMemory();
    expect(estimateCostUnits(memory)).toBe(0);
  });

  it("accumulates cost per attempt", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = buildFailureMemory("proj-001", issues, memory);

    expect(estimateCostUnits(memory)).toBe(2);
  });

  it("adds extra cost for provider swaps", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = recordProviderAttempt(memory, "scene-001", "mock");
    memory = recordProviderAttempt(memory, "scene-001", "mock-hq");

    const cost = estimateCostUnits(memory);
    expect(cost).toBeGreaterThan(1); // base 1 attempt + 1 provider swap = 3
  });

  it("flags budget exceeded when over limit", () => {
    const memory = makeMemory({
      sceneRecords: Array.from({ length: 5 }, (_, i) => ({
        attempts: Array.from({ length: 5 }, (__, j) => ({
          attemptNumber: j + 1,
          failureKind: "quality-check-failed" as const,
          issueSummary: "test",
          timestamp: "2026-01-01T00:00:00Z",
        })),
        firstFailedAt: "2026-01-01T00:00:00Z",
        lastFailedAt: "2026-01-01T00:00:00Z",
        providersTried: [],
        providersTriedCount: 0,
        recurringIssueKinds: [],
        sceneId: `scene-00${i + 1}`,
        totalAttempts: 5,
      })),
      totalProjectAttempts: 25,
    });

    const status = evaluateCostProtection(memory, 20);
    expect(status.budgetExceeded).toBe(true);
  });
});

// ── regenerationStrategy ──────────────────────────────────────────────────────

describe("regenerationStrategy", () => {
  it("returns retry-scene for first failure", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "warning" })];
    const memory = buildFailureMemory("proj-001", issues);
    const limits = getAllSceneLimits(memory, 3);
    const escalations = evaluateEscalations(memory, 3);
    const costStatus = evaluateCostProtection(memory, 20);
    const strategies = buildAllStrategies(memory, limits, escalations, costStatus);
    const strategy = strategies.find((s) => s.sceneId === "scene-001");

    expect(strategy?.action).toBe("retry-scene");
  });

  it("returns halt-pipeline when budget exceeded", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    const memory = buildFailureMemory("proj-001", issues);
    const limits = getAllSceneLimits(memory, 3);
    const escalations = evaluateEscalations(memory, 3);
    const overBudgetCost = evaluateCostProtection(memory, 0); // max budget 0

    const strategies = buildAllStrategies(memory, limits, escalations, overBudgetCost);
    const strategy = strategies.find((s) => s.sceneId === "scene-001");

    expect(strategy?.action).toBe("halt-pipeline");
  });

  it("returns flag-for-human-review at hard limit", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = buildFailureMemory("proj-001", issues, memory);
    memory = buildFailureMemory("proj-001", issues, memory);

    const limits = getAllSceneLimits(memory, 3);
    const escalations = evaluateEscalations(memory, 3);
    const costStatus = evaluateCostProtection(memory, 20);
    const strategies = buildAllStrategies(memory, limits, escalations, costStatus);
    const strategy = strategies.find((s) => s.sceneId === "scene-001");

    expect(strategy?.action).toBe("flag-for-human-review");
  });
});

// ── fallbackDecision ──────────────────────────────────────────────────────────

describe("fallbackDecision", () => {
  it("returns use-static-image for first failure", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "warning" })];
    const memory = buildFailureMemory("proj-001", issues);
    const limits = getAllSceneLimits(memory, 3);
    const escalations = evaluateEscalations(memory, 3);
    const costStatus = evaluateCostProtection(memory, 20);
    const strategies = buildAllStrategies(memory, limits, escalations, costStatus);
    const fallbacks = buildAllFallbacks(strategies, escalations, memory);
    const fallback = fallbacks.find((f) => f.sceneId === "scene-001");

    expect(fallback?.fallbackOutcome).toBe("use-static-image");
  });

  it("returns escalate for halt-pipeline strategy", () => {
    const strategy: SceneRegenerationStrategy = {
      action: "halt-pipeline",
      estimatedCostUnits: 20,
      reason: "Budget exceeded",
      sceneId: "scene-001",
    };
    const escalation = { escalationLevel: "hard-stop" as const, reason: "limit", sceneId: "scene-001" };
    const memory = makeMemory();

    const decision = decideFallback("scene-001", strategy, escalation, memory);
    expect(decision.fallbackOutcome).toBe("escalate");
  });

  it("returns escalate for flag-for-human-review strategy", () => {
    const strategy: SceneRegenerationStrategy = {
      action: "flag-for-human-review",
      estimatedCostUnits: 3,
      reason: "Human review needed",
      sceneId: "scene-002",
    };
    const escalation = { escalationLevel: "flag-human-review" as const, reason: "recurring", sceneId: "scene-002" };
    const memory = makeMemory();

    const decision = decideFallback("scene-002", strategy, escalation, memory);
    expect(decision.fallbackOutcome).toBe("escalate");
  });

  it("returns use-adjacent-scene after multiple recurring failures", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = buildFailureMemory("proj-001", issues, memory);

    const strategy: SceneRegenerationStrategy = {
      action: "retry-scene",
      estimatedCostUnits: 2,
      reason: "retry",
      sceneId: "scene-001",
    };
    const escalation = { escalationLevel: "retry-same" as const, reason: "retry", sceneId: "scene-001" };

    const decision = decideFallback("scene-001", strategy, escalation, memory);
    expect(decision.fallbackOutcome).toBe("use-adjacent-scene");
  });
});

// ── patternMemory ─────────────────────────────────────────────────────────────

describe("patternMemory", () => {
  it("returns top patterns sorted by frequency", () => {
    const global = makeGlobalMemory({
      failurePatterns: [
        { category: "visual", firstSeenAt: "", frequency: 5, lastSeenAt: "", pattern: "repetition-issue", projectIds: [], recoveryRate: 0, severity: "high", totalCostUnits: 5 },
        { category: "workflow", firstSeenAt: "", frequency: 2, lastSeenAt: "", pattern: "pacing-issue", projectIds: [], recoveryRate: 0, severity: "low", totalCostUnits: 2 },
        { category: "quality", firstSeenAt: "", frequency: 8, lastSeenAt: "", pattern: "quality-check-failed", projectIds: [], recoveryRate: 0, severity: "critical", totalCostUnits: 8 },
      ],
    });
    const top = getTopPatterns(global, 2);
    expect(top).toHaveLength(2);
    expect(top[0].pattern).toBe("quality-check-failed");
  });

  it("detects known recurring patterns", () => {
    const global = makeGlobalMemory({
      failurePatterns: [
        { category: "visual", firstSeenAt: "", frequency: 5, lastSeenAt: "", pattern: "repetition-issue", projectIds: [], recoveryRate: 0, severity: "high", totalCostUnits: 5 },
      ],
    });
    expect(isKnownRecurringPattern(global, "repetition-issue", 3)).toBe(true);
    expect(isKnownRecurringPattern(global, "pacing-issue", 3)).toBe(false);
  });
});

// ── providerScoring ───────────────────────────────────────────────────────────

describe("providerScoring", () => {
  it("calculates scores from project memory", () => {
    const issues = [makeIssue({ sceneId: "scene-001", severity: "critical" })];
    let memory = buildFailureMemory("proj-001", issues);
    memory = recordProviderAttempt(memory, "scene-001", "mock");
    const scores = calculateProviderScores(makeGlobalMemory(), memory);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].provider).toBe("mock");
  });

  it("returns best provider excluding unreliable ones", () => {
    const scores = [
      { failureCount: 8, lastUpdatedAt: "", provider: "bad-provider", reliabilityScore: 30, successCount: 2, totalAttempts: 10, workflowScores: {} },
      { failureCount: 1, lastUpdatedAt: "", provider: "good-provider", reliabilityScore: 90, successCount: 9, totalAttempts: 10, workflowScores: {} },
    ];
    const best = getBestProvider(scores, ["bad-provider"]);
    expect(best?.provider).toBe("good-provider");
  });

  it("identifies unreliable providers", () => {
    const scores = [
      { failureCount: 8, lastUpdatedAt: "", provider: "bad", reliabilityScore: 20, successCount: 2, totalAttempts: 10, workflowScores: {} },
      { failureCount: 1, lastUpdatedAt: "", provider: "good", reliabilityScore: 90, successCount: 9, totalAttempts: 10, workflowScores: {} },
    ];
    const unreliable = getUnreliableProviders(scores, 50);
    expect(unreliable).toHaveLength(1);
    expect(unreliable[0].provider).toBe("bad");
  });
});

// ── promptFailurePatterns ─────────────────────────────────────────────────────

describe("promptFailurePatterns", () => {
  it("detects known unstable phrases", () => {
    expect(isUnstablePromptPhrase("extreme camera shake effect")).toBe(true);
    expect(isUnstablePromptPhrase("gentle pan across landscape")).toBe(false);
  });

  it("extracts prompt failures from issue summaries", () => {
    const memory = makeMemory({
      sceneRecords: [{
        attempts: [{ attemptNumber: 1, failureKind: "visual-consistency-issue", issueSummary: "Extreme motion blur causing instability", timestamp: "" }],
        firstFailedAt: "", lastFailedAt: "", providersTried: [], providersTriedCount: 0,
        recurringIssueKinds: [], sceneId: "scene-001", totalAttempts: 1,
      }],
    });
    const results = extractPromptFailures(memory);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].phrase).toBe("extreme motion blur");
  });
});

// ── visualFailurePatterns ─────────────────────────────────────────────────────

describe("visualFailurePatterns", () => {
  it("extracts visual failures from issue summaries", () => {
    const memory = makeMemory({
      sceneRecords: [{
        attempts: [{ attemptNumber: 1, failureKind: "visual-consistency-issue", issueSummary: "Continuity drift detected between scenes", timestamp: "" }],
        firstFailedAt: "", lastFailedAt: "", providersTried: ["mock"], providersTriedCount: 1,
        recurringIssueKinds: [], sceneId: "scene-001", totalAttempts: 1,
      }],
    });
    const results = extractVisualFailures(memory);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pattern).toBe("continuity drift");
  });

  it("tracks related providers", () => {
    const memory = makeMemory({
      sceneRecords: [{
        attempts: [{ attemptNumber: 1, failureKind: "visual-consistency-issue", issueSummary: "Fallback image used for scene", timestamp: "" }],
        firstFailedAt: "", lastFailedAt: "", providersTried: ["mock", "mock-hq"], providersTriedCount: 2,
        recurringIssueKinds: [], sceneId: "scene-001", totalAttempts: 1,
      }],
    });
    const results = extractVisualFailures(memory);
    const fallbackEntry = results.find((r) => r.pattern === "fallback image degradation");
    expect(fallbackEntry?.relatedProviders).toContain("mock");
    expect(fallbackEntry?.relatedProviders).toContain("mock-hq");
  });
});

// ── preventionRecommendations ─────────────────────────────────────────────────

describe("preventionRecommendations", () => {
  it("generates provider avoidance recommendations", () => {
    const scores = [
      { failureCount: 8, lastUpdatedAt: "", provider: "bad-provider", reliabilityScore: 20, successCount: 2, totalAttempts: 10, workflowScores: {} },
    ];
    const memory = makeMemory();
    const global = makeGlobalMemory();
    const recs = generatePreventionRecommendations(global, memory, scores);
    const providerRec = recs.find((r) => r.category === "provider");
    expect(providerRec).toBeDefined();
    expect(providerRec?.action).toContain("bad-provider");
  });

  it("generates recommendations for recurring global patterns", () => {
    const global = makeGlobalMemory({
      failurePatterns: [
        { category: "visual", firstSeenAt: "", frequency: 5, lastSeenAt: "", pattern: "repetition-issue", projectIds: ["p1", "p2"], recoveryRate: 0, severity: "high", totalCostUnits: 5 },
      ],
    });
    const memory = makeMemory();
    const recs = generatePreventionRecommendations(global, memory, []);
    expect(recs.some((r) => r.relatedPatterns.includes("repetition-issue"))).toBe(true);
  });
});
