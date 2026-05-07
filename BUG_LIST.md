# v1.6 Bug List

## Critical

None.

## High

None.

## Medium

### P2: Repeated Factory submission can create duplicate review plans

- Area: Factory Planner / Review Inbox
- Evidence: During QA, the same raw idea produced multiple `REVIEW_PENDING` plans after repeated Factory submission attempts.
- User impact: Review Inbox can show duplicate plans for one idea, making it unclear which draft should be reviewed.
- Data impact: No data loss. Approval still created tasks from the selected final plan.
- Suggested fix: Add a guard in `sendToFactory` to prevent a new plan while a same-idea `REVIEW_PENDING` plan already exists, or supersede older pending plans when a revised plan is created.

### P2: No dedicated edit-idea UI

- Area: Idea Inbox
- Evidence: The manual QA checklist requested edit-idea coverage, but the current UI only supports create, convert, and archive.
- User impact: Users cannot correct typos or refine raw idea text without creating another idea.
- Data impact: No data loss.
- Suggested fix: Add a scoped edit action only if v1.6 or a later release explicitly includes idea editing.

### P2: Factory processing state is not visibly represented

- Area: Factory Planner
- Evidence: Plan generation eventually shows success/error, but there is no durable visible pending state or persisted `IN_FACTORY` transition during generation.
- User impact: Slow local Ollama responses can feel unresponsive.
- Data impact: No stuck state was observed.
- Suggested fix: Add a client-side pending button state or a server-side status transition in a separately scoped UX hardening task.

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
- Suggested fix: Add a project Playwright smoke script for repeatable screenshot and responsive checks.

## Known Limitations

- No external browser matrix was run.
- Mobile responsiveness was checked from responsive class structure and DOM, not screenshot evidence.
- Failed Factory-provider path was not reproduced because local Ollama responded successfully.
