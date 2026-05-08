# v1.6 Bug List

## Critical

None.

## High

None.

## Medium

### P2: Repeated Factory submission could create duplicate review plans

- Area: Factory Planner / Review Inbox
- Evidence: During QA, the same raw idea produced multiple `REVIEW_PENDING` plans after repeated Factory submission attempts.
- User impact: Review Inbox can show duplicate plans for one idea, making it unclear which draft should be reviewed.
- Data impact: No data loss. Approval still created tasks from the selected final plan.
- Status: Resolved on the current line by guarding `sendToFactory` against same-idea `REVIEW_PENDING` duplication and showing a review notice instead of creating another plan.

### P2: No dedicated edit-idea UI

- Area: Idea Inbox
- Evidence: The manual QA checklist requested edit-idea coverage, but the current UI only supports create, convert, and archive.
- User impact: Users cannot correct typos or refine raw idea text without creating another idea.
- Data impact: No data loss.
- Suggested fix: Add a scoped edit action only if v1.6 or a later release explicitly includes idea editing.

### P2: Factory processing state was not visibly represented

- Area: Factory Planner
- Evidence: Plan generation eventually shows success/error, but there is no durable visible pending state or persisted `IN_FACTORY` transition during generation.
- User impact: Slow local Ollama responses can feel unresponsive.
- Data impact: No stuck state was observed.
- Status: Resolved on the current line by persisting `IN_FACTORY` during planning, restoring the prior idea status on handled failure, and showing a disabled `Planning in Factory...` state in the inbox and Factory surfaces.

## Low

### P3: Archive action may need refresh before disappearance is obvious

- Area: Idea Inbox
- Evidence: Archived QA idea disappeared after reload and persisted correctly.
- User impact: Users may briefly wonder whether the action completed.
- Suggested fix: Add a success message or redirect refresh pattern if this becomes confusing.

### P3: Router keyword matching does not understand negation

- Area: Intelligence router
- Evidence: A phrase containing "no ... automation" still routed to Automation because keyword matching is literal.
- User impact: Rare false-positive pipeline route on negated text.
- Suggested fix: Keep deterministic routing but add regression tests for obvious negation patterns if false positives become common.

### P3: Browser screenshot tooling failed during QA

- Area: QA tooling, not confirmed app runtime
- Evidence: Browser screenshot capture timed out, and one in-app Browser tab crashed during a long DOM session.
- User impact: Reduced visual evidence for this QA pass.
- Status: Further mitigated. The project now has both route/export smoke coverage via `npm run test:smoke` and a full Playwright workflow spec at `tests/e2e/core-workflow.spec.ts` for create -> factory -> review -> revision -> approval -> task creation. Screenshot capture and dedicated responsive assertions are still future follow-up work.

## Known Limitations

- No external browser matrix was run.
- Mobile responsiveness was checked from responsive class structure and DOM, not screenshot evidence.
- Failed Factory-provider path was not reproduced because local Ollama responded successfully.
- Full workflow E2E now uses a deterministic test provider and isolated SQLite database, so it does not validate live Ollama behavior.
- Exact local E2E command used during this pass: `C:\Program Files\nodejs\node.exe node_modules/playwright/cli.js test tests/e2e/core-workflow.spec.ts`.
