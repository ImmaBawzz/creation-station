# Creation Station v1.7 Execution Kernel Spec

Status: Architecture documentation only. This file specifies behavior for a future autonomy kernel and does not implement production code.

## Kernel Contract

The execution kernel coordinates one bounded autonomy run:

```text
goal -> plan -> execute -> validate -> repeat -> stop
```

The kernel is responsible for control flow, limits, state transitions, validation routing, and stop reasons. Domain-specific logic remains in existing workflow modules, intelligence helpers, and approved application actions.

## Inputs

Kernel input must be explicit and serializable.

Required input:

- `runId`: unique identifier for the autonomy run.
- `goal`: normalized goal from user request, idea, plan, task, or intelligence recommendation.
- `workflowSnapshot`: current ideas, plans, review items, tasks, blockers, and relevant statuses.
- `intelligenceSnapshot`: deterministic recommendation and ranking signals.
- `memorySnapshot`: allowed short-term, task, failure, and preference memory.
- `policy`: limits, confidence thresholds, and approval requirements.

Optional input:

- `requestedMode`: suggest, dry-run, execute, or validate-only.
- `userConstraints`: explicit user instructions for scope, timing, or exclusions.
- `validationProfile`: checks required for the selected goal type.

## Outputs

Kernel output must be explicit and auditable.

Required output:

- `runId`
- `finalState`
- `stopReason`
- `selectedGoal`
- `plan`
- `attempts`
- `validationResults`
- `memoryUpdates`
- `approvalRequests`
- `deferredWork`

The output must be safe to display in a run report without exposing secrets.

## Execution Loop

### 1. Goal

Goal selection chooses exactly one target.

Priority order:

1. Explicit user-requested goal.
2. Existing task selected by user.
3. High-priority task recommended by the intelligence layer.
4. Plan waiting on a safe workflow transition.
5. Idea with high-confidence routing and no missing context.

Goal rejection reasons:

- Invalid or missing target.
- Ambiguous outcome.
- Requires external integration.
- Requires destructive action.
- Requires dependency, schema, or architecture change.
- Fails confidence threshold.
- Conflicts with current workflow state.

### 2. Plan

Planning produces the smallest safe action that moves the selected goal forward.

Plan fields:

- `stepId`
- `stepSummary`
- `preconditions`
- `actionType`
- `allowedToolsOrActions`
- `expectedOutcome`
- `validationChecks`
- `rollbackNote`
- `requiresHumanApproval`
- `confidence`

Planning rules:

- Prefer one action per iteration.
- Preserve existing architecture.
- Use existing workflow actions before introducing new mechanisms.
- If the plan has more than one risky action, split it.
- If the plan requires approval, stop before execution.

### 3. Execute

Execution performs only the selected step.

Execution modes:

- `suggest`: produce a plan and stop before action.
- `dry-run`: validate preconditions and expected effects without mutation.
- `execute`: perform allowed local action.
- `validate-only`: run checks against existing state.

Execution must not proceed when:

- Emergency stop is active.
- Required approval is missing.
- Retry or recursion limits are reached.
- Preconditions fail.
- Confidence is below threshold.
- Current state has changed in a way that invalidates the plan.

### 4. Validate

Validation determines whether execution achieved the expected outcome.

Validation result fields:

- `checkId`
- `status`: pass, fail, skipped, or blocked.
- `evidence`
- `nextAction`

Validation rules:

- No iteration may be considered complete without validation.
- Failed validation may retry only when retry policy allows it and the next attempt is meaningfully different.
- Repeated identical failures must stop and write failure memory.
- Validation must check both intended outcome and unintended high-risk side effects.

### 5. Repeat

The kernel may repeat only when:

- The previous validation passed.
- The next step is still within the same approved goal.
- Recursion limit has not been reached.
- Confidence remains above threshold.
- No approval checkpoint has been encountered.
- The next action is small, local, and reversible.

Repeat is not a license to bundle unrelated work. Each loop must select the next smallest safe step.

### 6. Stop

Stop is mandatory when completion, safety, uncertainty, or policy requires it.

Stop reasons:

- `completed`
- `needs_human_approval`
- `needs_clarification`
- `blocked`
- `validation_failed`
- `retry_limit_reached`
- `recursion_limit_reached`
- `low_confidence`
- `invalid_task`
- `state_changed`
- `emergency_stop`
- `out_of_scope`

## Confidence Model

Confidence is a policy input to execution, not a substitute for validation.

Suggested confidence bands:

- `0.85-1.00`: eligible for bounded execution if all safety gates pass.
- `0.70-0.84`: eligible for planning or dry-run; execution requires low-risk action.
- `0.50-0.69`: route to review with recommended next step.
- `<0.50`: stop for clarification or invalid-task handling.

Confidence factors:

- Goal clarity.
- Match to existing workflow action.
- Intelligence recommendation confidence.
- Task completeness.
- Blocker state.
- Availability of deterministic validation.
- Prior failure memory for similar actions.

## Supported Goal Types

### Idea Goal

Eligible actions:

- Recommend route.
- Prepare Factory handoff context.
- Stop for missing context.

Default execution posture: suggest or dry-run unless the user explicitly asks for supported workflow movement.

### Factory Plan Goal

Eligible actions:

- Identify review readiness.
- Route revision request.
- Prepare task creation only after approval.

Default execution posture: suggest or stop at review checkpoint.

### Review Goal

Eligible actions:

- Summarize pending review.
- Flag risks and missing details.
- Stop for human approval.

Default execution posture: no autonomous approval.

### Task Goal

Eligible actions:

- Execute one small local task.
- Validate result.
- Record blocked or failed state for follow-up.

Default execution posture: execute only when action is clearly local, reversible, and within approved scope.

### Intelligence Goal

Eligible actions:

- Convert recommendation into a candidate goal.
- Explain why the goal is or is not executable.
- Route low-confidence recommendations to review.

Default execution posture: advisory until mapped to a concrete idea, plan, review, or task goal.

## Concurrency

Initial v1.7 autonomy must assume one active run at a time.

Concurrency restrictions:

- No parallel mutation of the same idea, plan, or task.
- No overlapping task execution on the same plan.
- No background retries while user edits are possible.
- State must be re-read before execution after any delay.

## Idempotency

Every executable step should define how duplicate execution is avoided.

Examples:

- Check whether a task is already done before marking it done.
- Check whether a plan already has generated tasks before creating more.
- Check whether a review state already changed before acting.
- Include run IDs in future run records rather than duplicating user-visible content.

## Error Handling

Error classes:

- `PolicyError`: action violates autonomy policy.
- `PreconditionError`: required state is missing or stale.
- `ExecutionError`: action failed during execution.
- `ValidationError`: action completed but expected outcome was not met.
- `ConfidenceError`: confidence fell below threshold.
- `ApprovalRequiredError`: human checkpoint encountered.

Each error must map to a stop reason and, when useful, a failure memory entry.

## Kernel Acceptance Tests

The kernel is not ready for implementation until the scenarios in [TEST_SCENARIOS.md](./TEST_SCENARIOS.md) can be mapped to checks.

