# Intelligence Layer Test Strategy

## Coverage Targets

The v1.6 intelligence layer should keep direct unit coverage on every pure module:

- `router.ts`: pipeline routing, fallback behavior, confidence boundaries, and nullish runtime input tolerance.
- `validator.ts`: blocker reference resolution, waiting labels, missing references, cleared blockers, stale thresholds, invalid dates, and closed-task exclusions.
- `planner.ts`: plan context keys, active task counts, latest active age, and dependency impact aggregation.
- `prioritizer.ts`: next-task eligibility, scoring order, waiting-task filtering, stale penalties, and context diversification.
- `recommender.ts`: recommendation priority order, deduplication, limit handling, route suggestions, stale work, review work, revision work, and blocker work.

Coverage should favor behavior and regression protection over testing private implementation details. Future rule changes should update fixtures only when the intended user-facing output changes.

## Future Automation Testing Strategy

Automation should consume intelligence outputs through `src/lib/intelligence/index.ts`. Tests for future automation should:

- Use deterministic fixtures and fixed dates.
- Assert that automation treats recommendations as advisory signals, not direct writes.
- Cover eligibility gates separately from execution behavior.
- Keep connector, scheduler, and side-effect tests isolated behind adapters or mocks.
- Verify that no automation path bypasses existing user-action write flows unless explicitly approved.

## Future Memory Testing Strategy

Memory integration should enter the intelligence layer as explicit input data, not module-level state. Tests should:

- Cover recommendations with and without memory inputs.
- Assert deterministic fallback behavior when memory is empty, stale, malformed, or unavailable.
- Keep score adjustments explainable and bounded.
- Test preference-like memory, such as dismissed or pinned recommendations, separately from routing and task scoring.
- Avoid snapshotting broad recommendation payloads unless the exact text is intentionally part of the contract.
