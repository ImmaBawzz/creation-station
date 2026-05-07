# Creation Station v1.7 Memory Model

Status: Architecture documentation only. This file defines memory boundaries for a future autonomy layer and does not add persistence or production code.

## Memory Principles

Memory exists to make bounded autonomy safer and more consistent. It must not become hidden authority over the current workflow.

Rules:

- Current workflow state always overrides memory.
- Memory reads and writes must be explicit in the autonomy run record.
- Memory must be scoped by run, task, failure class, or user preference.
- Memory must not store secrets.
- Memory must not silently approve actions.
- Memory must be editable, clearable, and inspectable before any production implementation.

## Memory Types

### Short-Term Memory

Short-term memory exists only for the active autonomy run.

Purpose:

- Track the current goal, plan, attempted steps, validation results, and stop reason.
- Prevent repeated work inside the same run.
- Carry context between loop iterations.

Example fields:

- `runId`
- `selectedGoal`
- `currentPlan`
- `completedSteps`
- `attemptedActions`
- `validationEvidence`
- `activeStopConditions`

Lifetime:

- Created at run start.
- Updated after each loop stage.
- Cleared or archived into a run record at stop.

Allowed use:

- Detect repeated identical actions.
- Support validation.
- Explain why the run stopped.

Forbidden use:

- Persist unreviewed product decisions as future preference.
- Override task, plan, or review state.

### Task Memory

Task memory records execution context for a specific task or workflow item.

Purpose:

- Remember prior attempts on a task.
- Preserve why a task was blocked, deferred, or completed.
- Help avoid duplicating task execution.

Example fields:

- `taskId`
- `planId`
- `ideaId`
- `lastAttemptAt`
- `lastOutcome`
- `blockedReason`
- `validationSummary`
- `nextRecommendedStep`

Lifetime:

- Scoped to the task or workflow item.
- Retained while the task is active.
- Archived or compacted when the task is done or archived.

Allowed use:

- Lower confidence for repeatedly failed actions.
- Prefer tasks with clear validation history.
- Route blocked tasks to review.

Forbidden use:

- Mark tasks complete without validation.
- Hide failed attempts from the user.
- Infer permission for broader changes.

### Failure Memory

Failure memory records patterns that should reduce repetition and improve safety.

Purpose:

- Prevent infinite retry loops.
- Recognize recurring invalid states.
- Route known fragile actions to review sooner.

Example fields:

- `failureId`
- `failureClass`
- `affectedEntityType`
- `affectedEntityId`
- `firstSeenAt`
- `lastSeenAt`
- `attemptCount`
- `rootCauseSummary`
- `recommendedRecovery`
- `suppressionUntil`

Failure classes:

- Validation failure.
- Precondition failure.
- Low confidence.
- Invalid task.
- State changed during run.
- Approval required.
- Tool or command failure.

Lifetime:

- Retained long enough to prevent repeated failures.
- Can be compacted into counters and summaries.
- Must be clearable.

Allowed use:

- Stop identical retries.
- Require human approval after repeated failure.
- Reduce confidence for similar actions.

Forbidden use:

- Permanently blacklist a valid workflow without user review.
- Store raw sensitive data from failed commands.

### Preference Memory

Preference memory records explicit user preferences that affect autonomy behavior.

Purpose:

- Respect stable user choices about scope, risk, cadence, and presentation.
- Avoid asking the same preference question repeatedly.

Example fields:

- `preferenceKey`
- `preferenceValue`
- `source`
- `createdAt`
- `updatedAt`
- `expiresAt`

Preference examples:

- Prefer documentation before implementation.
- Keep autonomy in suggest mode unless explicitly told to execute.
- Prefer smaller commits.
- Avoid schema changes unless separately approved.
- Route low-confidence actions to Review.

Lifetime:

- Persistent only after explicit user confirmation.
- Expirable when tied to project phase or release.

Allowed use:

- Shape planning defaults.
- Raise approval strictness.
- Choose report verbosity.

Forbidden use:

- Infer consent for destructive action.
- Store secrets, credentials, or private external data.
- Override explicit instructions in the current turn.

## Memory Priority

When signals conflict, use this priority order:

1. Current user instruction.
2. Explicit project docs and scope locks.
3. Current workflow/database state.
4. Failsafe policy.
5. Short-term memory from the active run.
6. Task memory.
7. Failure memory.
8. Preference memory.
9. Intelligence recommendation.

Memory never outranks current user instruction, project scope, workflow state, or failsafe policy.

## Read Policy

Memory reads must be requested by memory type and scope.

Examples:

- Read short-term memory for active `runId`.
- Read task memory for selected `taskId`.
- Read failure memory for matching `actionType`.
- Read preference memory for autonomy mode.

The autonomy kernel must record which memory entries affected planning or stop decisions.

## Write Policy

Memory writes may occur only at defined lifecycle points:

- After plan creation: short-term memory update.
- After execution attempt: short-term and task memory update.
- After validation failure: failure memory update.
- After explicit user preference: preference memory update.
- At stop: run summary update.

Memory writes must include:

- Source run.
- Reason.
- Scope.
- Expiration or retention policy when applicable.

## Storage Position For v1.7

This document does not require a new storage system.

Future implementation options, pending approval:

- In-memory only for first kernel prototype.
- Local JSON run records for development visibility.
- Existing database persistence only after a schema plan is approved.

Default recommendation:

- Start with explicit in-memory structures and documentation-backed run reports.
- Do not add Prisma models in the first implementation slice.

## Privacy And Safety

Memory must avoid:

- Secrets.
- API keys.
- Raw credentials.
- Full command outputs containing sensitive paths or tokens.
- External account data.
- Unreviewed user personal data beyond local workflow content already present in Creation Station.

Memory should prefer summaries, counters, entity IDs, and reason codes.

