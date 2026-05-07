# Creation Station v1.7 Failsafe Protocols

Status: Architecture documentation only. This file defines required safety controls for a future autonomy layer.

## Failsafe Goals

Failsafes keep autonomy bounded, explainable, and subordinate to user-controlled workflow gates.

The failsafe controller must prevent:

- Infinite loops.
- Repeated identical failures.
- Low-confidence execution.
- Unauthorized destructive or architectural changes.
- Silent bypass of Review.
- Background execution after an emergency stop.

## Recursion Limits

Recursion limits bound the number of goal -> plan -> execute -> validate iterations.

Suggested defaults:

- Maximum iterations per run: 5.
- Maximum nested planning depth: 2.
- Maximum same-entity revisit count per run: 2.
- Maximum automatic continuation after success: 1 additional step unless explicitly requested.

Stop reason:

- `recursion_limit_reached`

Required behavior:

- Stop immediately when the limit is reached.
- Record the last completed step and the next recommended step.
- Do not start a new run automatically to bypass the limit.

## Retry Limits

Retry limits prevent repeated failed execution.

Suggested defaults:

- Maximum retries for one action: 2.
- Maximum retries after validation failure: 1.
- Maximum retries after precondition failure: 0 unless state changed positively.
- Maximum retries for tool or command failure: 1 when the retry changes a parameter or approach.

Stop reason:

- `retry_limit_reached`

Required behavior:

- Never repeat an identical failing action more than once.
- Write failure memory after retry exhaustion.
- Route to human review when failure reason is unclear.

## Confidence Thresholds

Confidence thresholds decide whether autonomy may execute, suggest, or stop.

Suggested defaults:

- Execute threshold: `0.85`
- Dry-run threshold: `0.70`
- Review threshold: `0.50`
- Stop threshold: below `0.50`

Routing:

- `>= 0.85`: may execute if all safety gates pass.
- `0.70-0.84`: may plan or dry-run; execute only if action is read-only or trivially reversible.
- `0.50-0.69`: route to Review or request clarification.
- `< 0.50`: stop as low confidence or invalid task.

Confidence must be lowered by:

- Missing requirements.
- Ambiguous goal wording.
- Prior similar failures.
- Blocked task state.
- No deterministic validation path.
- Stale workflow snapshot.
- External dependency assumptions.

Confidence must not be raised above the execution threshold by preference memory alone.

## Human Approval Checkpoints

Human approval is required before:

- Plan approval.
- Destructive file, data, branch, or backup operations.
- Prisma schema changes.
- Dependency installation or removal.
- Architecture changes.
- New external services or connectors.
- Secrets, authentication, or permission changes.
- Bulk task status changes.
- Archiving or deleting user-created workflow records.
- Any action outside current project scope.

Approval behavior:

- Stop before execution.
- Explain the proposed action, reason, and risk.
- Provide the smallest safe next step.
- Resume only after explicit user approval.

Review-specific rule:

- The autonomy layer may prepare review context, but it must not approve its own output or bypass the Review Inbox.

## Emergency Stop

Emergency stop halts all autonomy activity immediately.

Triggers:

- User says stop, pause, cancel, abort, or emergency stop.
- A destructive action is detected without approval.
- State changes unexpectedly during execution.
- Validation detects data loss or severe workflow regression.
- The kernel cannot determine whether an action is safe.

Required behavior:

- Stop the active run.
- Do not retry.
- Do not start follow-up execution.
- Preserve current state.
- Report last action, known effects, and unresolved risk.

Emergency stop persists until cleared by explicit user instruction.

## Invalid Task Handling

A task is invalid for autonomous execution when:

- It has no clear expected outcome.
- It references missing entities.
- It conflicts with current plan or idea state.
- It requires unavailable tools or external services.
- It requires approval that has not been granted.
- It cannot be validated deterministically.

Required behavior:

- Stop with `invalid_task`.
- Record why the task is invalid.
- Recommend the smallest clarification or review action.
- Do not mutate the task unless an approved existing workflow action supports marking it blocked.

## Infinite Loop Prevention

Loop prevention uses short-term memory and failure memory.

Detection signals:

- Same goal selected repeatedly with no state change.
- Same action attempted repeatedly with same failure.
- Validation result unchanged across attempts.
- Plan changes wording but not actual action.
- Run keeps returning to the same blocked state.

Required behavior:

- Stop before another attempt.
- Record repeated state and last evidence.
- Route to Review or user clarification.

## State Freshness

The kernel must verify state freshness before execution.

Freshness checks:

- Selected entity still exists.
- Status is unchanged since planning.
- Blocker state is unchanged.
- Review state is unchanged.
- No newer user action supersedes the plan.

If state changed:

- Re-plan if the new state clearly reduces risk and remains in scope.
- Stop with `state_changed` if safety or intent is unclear.

## Audit Requirements

Each stopped run must report:

- Final state.
- Stop reason.
- Last attempted action.
- Limits consumed.
- Approval checkpoint encountered, if any.
- Memory writes created, if any.
- Next smallest safe step.

## Minimum Failsafe Acceptance Criteria

A future autonomy implementation is not acceptable unless it can demonstrate:

- Recursion limits stop repeated loops.
- Retry limits stop repeated failures.
- Low confidence routes to review or clarification.
- Approval checkpoints block unsafe execution.
- Emergency stop prevents further autonomous action.

