# Intelligence Layer v1.6 Architecture

## Scope

The v1.6 intelligence layer is a deterministic, local-first analysis layer over existing ideas, Factory plans, tasks, blockers, and labels. It does not call external AI APIs, write data, or require database schema changes.

## Module Responsibilities

- `src/lib/intelligence/router.ts` detects the best pipeline route for an idea from its category, title, raw text, and tags.
- `src/lib/intelligence/validator.ts` evaluates task health signals, including waiting state, blocker references, missing blockers, cleared blockers, and staleness.
- `src/lib/intelligence/planner.ts` defines plan/task input shapes and builds plan-level task momentum context for downstream scoring.
- `src/lib/intelligence/prioritizer.ts` ranks next tasks using priority, status, age, project momentum, dependency impact, and staleness penalties.
- `src/lib/intelligence/recommender.ts` composes user-facing recommendations from idea routes, review state, revision state, blocker health, stale work, and next-task priority.
- `src/lib/intelligence/index.ts` is the public export layer for application code.

## Data Flow

```text
Pages and components load existing local data
  -> router validates idea route signals
  -> validator derives blocker and stale-work signals
  -> planner aggregates plan/task momentum context
  -> prioritizer ranks next available tasks
  -> recommender selects and deduplicates visible recommendations
  -> UI renders existing panels and task board signals
```

Database reads remain outside the intelligence modules. The modules accept plain TypeScript objects and return derived objects only.

## Future Memory Integration Points

- Add a read-only memory adapter before routing if future local memory stores approved user preferences or historical route choices.
- Add optional memory-derived score adjustments in `prioritizer.ts` after deterministic task scores are computed.
- Add recommendation suppression or pinning as a separate preference input to `recommender.ts` if a future schema or local settings store is approved.
- Keep memory reads explicit inputs rather than hidden module-level state so recommendations remain testable.

## Future Automation Integration Points

- Automation should consume exported recommendations or next-task rankings from `index.ts` rather than reaching into internal modules.
- Any future reminder, schedule, or background check should treat intelligence output as advisory and leave writes to existing user actions.
- Automation eligibility can be added as a separate derived field in `recommender.ts` without changing current recommendation behavior.
- External connectors, agent runners, and background execution remain out of v1.6 scope.

## Compatibility Notes

- Existing imports from `@/lib/intelligence` resolve through `src/lib/intelligence/index.ts`.
- The public functions and current recommendation behavior are preserved.
- No Prisma schema changes or new dependencies are required.
