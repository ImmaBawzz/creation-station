# Creation Station v1.6 Release Checklist

## Scope

v1.6 prepares the local deterministic intelligence layer for future expansion by modularizing the existing heuristics and adding focused unit coverage. This release does not add new product features, external AI APIs, autonomy, automation runners, or database schema changes.

## Stability Audit

- Branch verified: `feature/v1.6-intelligence-layer`.
- Folder architecture verified: `src/lib/intelligence/` is split into `router`, `validator`, `planner`, `prioritizer`, `recommender`, and `index` modules.
- Naming consistency verified: intelligence modules use action-oriented names that match their responsibilities; tests mirror source module names with `.test.ts`.
- Duplicate utility review: `includesSearch` exists in both `src/app/page.tsx` and `src/app/components/TaskBoard.tsx`; this is a small local duplication and should not be refactored during release hardening.
- Dead file review: no dead intelligence files found after replacing `src/lib/intelligence.ts` with the module folder. Generated folders such as `.next`, `coverage`, and `src/generated/prisma` remain ignored/runtime artifacts.
- Outdated docs review: older v0.5, v1.1, v1.4, and v1.5 docs remain historical references. Current v1.6 work is represented by `docs/planning/v1.6-intelligence-layer-plan.md`, `docs/architecture/intelligence-layer-v1.6.md`, `docs/testing/intelligence-test-strategy.md`, and this checklist.

## Untracked File Disposition

- `agent-next-input.md`: do not commit for v1.6. It is a transient autonomy handoff prompt and outside this hardening scope.
- `docs/AUTONOMY_LOOP.md`: do not commit for v1.6. It describes future autonomy process and would imply scope expansion.
- `docs/STOP_CONDITIONS.md`: do not commit for v1.6. Its content overlaps existing agent instructions and is tied to the uncommitted autonomy notes.

These files should remain untracked until a separate autonomy/process documentation task explicitly approves them. They were not deleted because deleting untracked user files is a destructive action.

## Build Verification

- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run test:coverage`
- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [x] `npx prisma generate`
- [x] Localhost smoke check returns HTTP 200 from `http://127.0.0.1:3000`

## Test Verification

- Intelligence unit tests cover:
  - [x] route detection and fallback behavior
  - [x] task waiting and blocker validation
  - [x] stale task validation
  - [x] task momentum context aggregation
  - [x] next-task prioritization
  - [x] recommendation priority, deduplication, and limit behavior
- Coverage thresholds for `src/lib/intelligence/*.ts`:
  - [x] branches >= 70%
  - [x] functions >= 80%
  - [x] lines >= 80%
  - [x] statements >= 80%

## Dependency And Vulnerability Report

`npm audit fix` was run without `--force`.

Remaining audit findings:

- 5 moderate vulnerabilities remain.
- `@hono/node-server <1.19.13` via `@prisma/dev` and `prisma`.
- `postcss <8.5.10` via `next`.
- npm reports fixes only through `npm audit fix --force`.
- The proposed forced fixes would install breaking package versions, including `prisma@6.19.3` and `next@9.3.3`, so they were intentionally not applied.

Dependency risk summary:

- Current residual risk is in framework/tooling transitive dependencies, not new v1.6 intelligence code.
- No external AI provider, connector, or runtime dependency was added for the intelligence layer.
- Vitest and `@vitest/coverage-v8` are dev-only dependencies used for local test execution and coverage gates.
- Major dependency remediation should be handled in a separate dependency-upgrade branch with full Prisma and Next.js regression testing.

## Deployment Checklist

- [ ] Confirm `.env` and `.env.local` are not committed.
- [ ] Confirm Prisma schema has no v1.6 migration.
- [ ] Run `npx prisma generate` if the deployment environment requires a fresh generated client.
- [ ] Run `npm run build` in the target environment.
- [ ] Start the app with the configured production command.
- [ ] Smoke test the core workflow: Idea Inbox, Factory, Review Inbox, revision, approval, and task board.
- [ ] Verify the AI Recommendations panel renders without runtime errors.

## Rollback Strategy

- Roll back the stability hardening commit if tests or coverage tooling causes CI/runtime issues.
- Roll back the modularization commit if any intelligence import resolution or recommendation behavior regresses.
- Stable pre-v1.6 baseline remains the v1.5 release line.
- No database rollback is required because v1.6 does not change Prisma schema or persisted data.

## Known Limitations

- Intelligence remains deterministic heuristic logic, not semantic memory or AI reasoning.
- Coverage thresholds are scoped to intelligence modules only.
- Older historical docs still exist and can confuse readers unless they follow the newest v1.6 docs first.
- Existing audit findings require a separate major dependency remediation plan.
- Localhost smoke verification does not replace the full manual workflow QA pass.

## Future Expansion Notes

- Add memory only through explicit inputs to the intelligence modules.
- Add automation only as a consumer of intelligence outputs, not as a writer inside the intelligence layer.
- Add integration tests for UI recommendation rendering before changing recommendation presentation.
- Consider a later docs cleanup pass that clearly separates historical docs from active release docs.
