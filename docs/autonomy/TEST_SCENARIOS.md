# Creation Station v1.7 Autonomy Test Scenarios

Status: Architecture documentation only. These scenarios define future validation coverage and do not implement tests.

## Test Strategy

Autonomy tests should prove control flow and safety before product capability. The first test suite should use deterministic fixtures for ideas, plans, reviews, tasks, blockers, intelligence recommendations, policy, and memory.

Initial coverage should prioritize:

- Execution loop correctness.
- Stop reasons.
- Memory updates.
- Failsafe enforcement.
- Human approval routing.
- No mutation when execution is disallowed.

## Scenario 1: Successful Loop

Purpose:

Verify that a clear, safe task can move through goal -> plan -> execute -> validate -> stop.

Fixture:

- One approved Factory plan.
- One unblocked `TODO` task with high priority.
- Intelligence layer ranks the task as next best work with confidence `0.92`.
- No failure memory for the action.
- Policy allows one bounded execution step.

Expected loop:

1. Goal selects the task.
2. Plan creates one executable step with deterministic validation.
3. Execute performs the allowed action.
4. Validate confirms expected outcome.
5. Kernel stops with `completed`.

Expected assertions:

- Exactly one goal is selected.
- Exactly one execution attempt is recorded.
- Validation status is pass.
- Stop reason is `completed`.
- Short-term memory records the completed step.
- Task memory records the successful attempt.
- No failure memory is written.
- No approval request is created.

## Scenario 2: Failed Execution

Purpose:

Verify that execution failure retries within limits and then stops cleanly.

Fixture:

- One valid task with clear expected outcome.
- Execution action fails due to a local command or action error.
- Retry limit is 1.
- Second attempt either fails identically or validation still fails.

Expected loop:

1. Goal selects the task.
2. Plan passes preconditions.
3. Execute fails.
4. Kernel retries once only if the retry is allowed.
5. Validation or execution fails again.
6. Kernel stops with `retry_limit_reached` or `validation_failed`.

Expected assertions:

- Attempt count does not exceed policy.
- Identical failing action is not repeated more than allowed.
- Failure memory is written with failure class and recovery note.
- Task memory records the failed attempt.
- Deferred work contains a review or recovery recommendation.
- No unrelated task or plan is modified.

## Scenario 3: Infinite Loop Prevention

Purpose:

Verify that repeated planning against unchanged state stops before unbounded recursion.

Fixture:

- One task remains blocked.
- Planner repeatedly proposes the same unblock step.
- Validation result remains blocked.
- Recursion limit is 3.
- Same-entity revisit limit is 2.

Expected loop:

1. Goal selects the blocked task or related recommendation.
2. Plan attempts to identify a safe next step.
3. Validation reports unchanged blocked state.
4. Kernel detects repeated same-entity or same-action loop.
5. Kernel stops before exceeding recursion policy.

Expected assertions:

- Stop reason is `recursion_limit_reached` or `blocked`.
- No more than the configured number of iterations occurs.
- Short-term memory contains repeated-action evidence.
- Failure memory records loop prevention context if applicable.
- Output routes the task to human review or blocker clarification.

## Scenario 4: Invalid Task Handling

Purpose:

Verify that malformed or unsafe tasks are rejected before execution.

Fixture:

- One task has missing expected outcome or references a missing plan.
- Intelligence recommendation confidence may be present but the task preconditions fail.
- Policy requires deterministic validation for execution.

Expected loop:

1. Goal intake evaluates the task.
2. Precondition check fails.
3. No execution occurs.
4. Kernel stops with `invalid_task`.

Expected assertions:

- Execution attempt count is 0.
- Stop reason is `invalid_task`.
- Output includes invalid fields or missing references.
- Failure memory may record invalid-task class.
- No task status is changed unless explicitly approved by an existing workflow action.
- Deferred work recommends the smallest clarification or repair step.

## Scenario 5: Low Confidence Routing

Purpose:

Verify that low-confidence goals become review or clarification work instead of autonomous execution.

Fixture:

- One idea has ambiguous text and no tags.
- Intelligence route confidence is `0.56`.
- No existing Factory plan.
- Policy execute threshold is `0.85`, review threshold is `0.50`.

Expected loop:

1. Goal intake identifies the idea as a candidate.
2. Planner cannot produce a high-confidence executable step.
3. Kernel routes to Review or clarification.
4. No Factory plan or tasks are created.

Expected assertions:

- Stop reason is `low_confidence` or `needs_clarification`.
- Approval request or review recommendation is created.
- No execution attempts occur.
- Memory records the low-confidence reason.
- Output explains which context is missing.

## Scenario 6: Human Approval Checkpoint

Purpose:

Verify that autonomy stops before actions requiring explicit approval.

Fixture:

- One task asks for a Prisma schema change or dependency installation.
- Goal is otherwise clear.
- Policy marks schema and dependency changes as approval-required.

Expected loop:

1. Goal selects the task.
2. Plan detects approval-required action.
3. Kernel stops before execution.

Expected assertions:

- Stop reason is `needs_human_approval`.
- Execution attempt count is 0.
- Approval request includes action, reason, and risk.
- No files, dependencies, or schema are changed.

## Scenario 7: Emergency Stop

Purpose:

Verify that emergency stop prevents further autonomous action.

Fixture:

- Active run is in planning or execution.
- Emergency stop flag is raised by user command or severe safety detection.

Expected loop:

1. Kernel receives emergency stop.
2. Active step halts at the nearest safe boundary.
3. No retry or repeat occurs.
4. Output reports last known state.

Expected assertions:

- Stop reason is `emergency_stop`.
- No additional execution attempts happen after stop.
- Emergency stop remains active until explicitly cleared.
- Run record includes unresolved risk and next manual step.

## Scenario 8: State Changed During Run

Purpose:

Verify that autonomy does not act on stale workflow state.

Fixture:

- A task is selected and planned.
- Before execution, the task status changes or blocker state changes.

Expected loop:

1. Goal and plan are created from snapshot A.
2. Freshness check reads snapshot B.
3. Kernel detects mismatch.
4. Kernel re-plans only if the new state is clearly safe; otherwise stops.

Expected assertions:

- Execution does not proceed against stale preconditions.
- Stop reason is `state_changed` when safety is unclear.
- No duplicate or conflicting action is performed.

## Scenario 9: Review Boundary Preservation

Purpose:

Verify that autonomy never approves its own plan or bypasses Review.

Fixture:

- One Factory plan is waiting for review.
- Intelligence recommends review as next action with high confidence.

Expected loop:

1. Goal selects pending review.
2. Plan prepares review context.
3. Kernel stops at approval checkpoint.

Expected assertions:

- Stop reason is `needs_human_approval`.
- Plan status is not approved autonomously.
- Tasks are not created from an unapproved plan.
- Output links the next step to Review.

## Scenario 10: Memory Priority Conflict

Purpose:

Verify that current instructions and workflow state override memory.

Fixture:

- Preference memory says execute small tasks automatically.
- Current user instruction says documentation only.
- A task recommendation is available.

Expected loop:

1. Goal intake sees the current user instruction.
2. Planner restricts mode to documentation or suggest-only.
3. Kernel does not execute the task.

Expected assertions:

- Current instruction wins over preference memory.
- No production code changes occur.
- Run output explains the constraint.

## Minimum Future Test Matrix

```text
Scenario                         Expected stop reason
Successful loop                  completed
Failed execution                 retry_limit_reached or validation_failed
Infinite loop prevention         recursion_limit_reached or blocked
Invalid task handling            invalid_task
Low confidence routing           low_confidence or needs_clarification
Human approval checkpoint        needs_human_approval
Emergency stop                   emergency_stop
State changed during run         state_changed
Review boundary preservation     needs_human_approval
Memory priority conflict         out_of_scope or completed in suggest-only mode
```

## Acceptance Criteria

The future autonomy system should not be considered ready until:

- All required scenarios have deterministic fixtures.
- Every scenario verifies stop reason and mutation behavior.
- Low-confidence and approval-required paths produce no execution side effects.
- Failed and repeated loops write appropriate memory summaries.
- Successful loops validate the expected outcome before completion.

