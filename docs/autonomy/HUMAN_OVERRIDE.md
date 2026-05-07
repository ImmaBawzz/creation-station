# Creation Station v1.7 Human Override

Status: Architecture documentation only. This file defines human control requirements for a future autonomy layer and does not implement production code.

## Purpose

Human override keeps autonomy subordinate to the user. The autonomy layer may assist with planning, execution, validation, and reporting, but the user remains the final authority for high-risk actions, unclear output, permission changes, and recovery decisions.

This document complements:

- [AUTONOMY_ARCHITECTURE.md](./AUTONOMY_ARCHITECTURE.md)
- [EXECUTION_KERNEL_SPEC.md](./EXECUTION_KERNEL_SPEC.md)
- [FAILSAFE_PROTOCOLS.md](./FAILSAFE_PROTOCOLS.md)
- [MEMORY_MODEL.md](./MEMORY_MODEL.md)

## Manual Approval Checkpoints

Autonomy must pause before execution when an action crosses a manual approval checkpoint. The pause must happen before mutation, before external cost is incurred, and before any irreversible operation begins.

Required approval prompt fields:

- Proposed action.
- Target entity or file.
- Reason for the action.
- Expected outcome.
- Risk level.
- Validation plan.
- Rollback or recovery option.
- Consequence of doing nothing.

### Always Requires Approval

Autonomy must pause for approval before:

- Approving a Factory plan.
- Bypassing Review.
- Changing product scope or architecture.
- Changing Prisma schema or persisted data shape.
- Adding, removing, or upgrading dependencies.
- Changing secrets, authentication, permissions, or provider configuration.
- Connecting external services, accounts, APIs, or webhooks.
- Committing, pushing, merging, rebasing, deleting branches, or force-pushing.
- Bulk-changing tasks, ideas, plans, blockers, or reviews.
- Archiving or deleting user-created records.
- Running long-lived background execution.
- Starting financial, paid, rate-limited, or API-heavy operations.

### High-Risk Actions

High-risk actions require approval even when technically reversible.

High-risk examples:

- Any action that affects multiple workflow records.
- Any action that may change user-facing workflow semantics.
- Any action that changes backup, restore, export, or analytics behavior.
- Any action that changes task generation or plan approval behavior.
- Any action with unclear validation.
- Any action that depends on inferred user intent.
- Any action that has failed previously in the same run or failure class.

Required behavior:

- Stop with `needs_human_approval`.
- Present the smallest safe alternative when available.
- Do not lower the approval requirement because confidence is high.

### Destructive Actions

Destructive actions require explicit approval and a recovery plan.

Destructive examples:

- Deleting files, database records, backups, branches, or generated artifacts.
- Overwriting user-created content.
- Resetting Git history or local state.
- Dropping, truncating, or migrating data.
- Removing tasks, plans, blockers, or ideas.
- Irreversibly marking work as complete, archived, or rejected in bulk.

Required behavior:

- Stop before the destructive action.
- Identify affected data.
- State whether rollback is possible.
- Require explicit user confirmation for that exact action.
- Refuse to proceed if the target or scope is ambiguous.

### Financial Or API-Heavy Actions

Financial and API-heavy actions require approval before any cost, quota use, or external side effect.

Examples:

- Calling paid AI APIs.
- Running high-volume local or remote generation.
- Uploading, syncing, or publishing through external services.
- Creating cloud resources.
- Triggering paid jobs, queues, model runs, or hosted workflows.
- Sending bulk API requests.
- Actions that may hit rate limits or consume large quotas.

Required approval details:

- Provider or service.
- Estimated cost or quota impact when knowable.
- Expected request volume.
- Data that will leave the local environment.
- Stop and retry policy.

Default v1.7 posture:

- Financial and API-heavy actions are not autonomous by default.
- If cost or quota impact cannot be estimated, route to approval.

## Manual Intervention Tools

Manual intervention tools are operator controls that can alter or halt an active autonomy run. These are control concepts for future implementation, not production UI requirements in this document.

### Pause Execution

Pause suspends the run at the next safe boundary without discarding context.

Use when:

- The user wants to inspect the current plan.
- The run is correct but should wait.
- External context changed.
- The user needs to adjust permission tier or constraints.

Required behavior:

- Finish the current atomic read-only step if already in progress.
- Do not start a new mutation.
- Preserve short-term memory and run state.
- Report current goal, plan, last completed step, and pending action.
- Resume only after explicit user instruction.

### Stop Execution

Stop terminates the active run and prevents automatic continuation.

Use when:

- The user cancels the run.
- The action is no longer wanted.
- The run entered unsafe, unclear, or stale state.
- Emergency stop is triggered.

Required behavior:

- Halt the run immediately at the nearest safe boundary.
- Do not retry.
- Do not start another goal automatically.
- Record stop reason and last known effects.
- Preserve evidence for audit.

### Reroute Execution

Reroute changes the run target or mode while preserving audit history.

Use when:

- The selected goal is valid but not the preferred next step.
- The user wants Review before execution.
- The user wants suggest-only or dry-run mode.
- The task should be moved from execution to revision or clarification.

Allowed reroute targets:

- Idea clarification.
- Factory planning.
- Review.
- Revision.
- Task execution.
- Validation-only.
- Documentation-only.

Required behavior:

- Close the current plan step as rerouted.
- Record the user-directed target.
- Re-evaluate confidence and approval requirements.
- Do not carry over stale execution permission.

### Rollback Execution

Rollback attempts to restore the prior state after an executed action.

Use when:

- Execution produced an incorrect result.
- Validation failed after mutation.
- User rejects the output.
- A high-risk side effect is detected.

Required behavior:

- Roll back only changes with a known recovery path.
- Ask for approval before destructive rollback.
- Preserve audit logs even when rollback succeeds.
- Record what was restored, what could not be restored, and residual risk.
- If rollback is impossible, stop and present manual recovery steps.

Rollback is not a substitute for approval. Actions without a credible rollback path should require stricter approval before execution.

## Output Rejection Logic

Users must be able to reject autonomy output after execution, validation, or review. Rejection must affect future confidence and routing.

### Reject Bad Task Execution

Bad task execution means the task was performed incorrectly, incompletely, out of scope, or with unacceptable side effects.

Required behavior:

- Mark the run result as rejected in the audit record.
- Preserve the rejected output for traceability.
- Do not mark the task complete based on rejected output.
- Create or recommend a recovery step.
- Write failure memory for the execution class.
- Lower confidence for similar future actions.

Rejection reasons:

- Incorrect output.
- Incomplete output.
- Scope drift.
- Failed validation.
- Poor quality.
- Unsafe side effect.
- User preference mismatch.

### Force Revision

Force revision routes output back to planning, Factory revision, or task repair.

Use when:

- A Factory plan is plausible but not approved.
- A task result needs changes before completion.
- Requirements changed during execution.
- The output is usable only after rework.

Required behavior:

- Stop autonomous continuation.
- Attach revision reason and requested changes.
- Preserve the original output and validation evidence.
- Re-plan only after the revision scope is clear.
- Require approval if the revision expands scope or risk.

### Downgrade Autonomy Confidence

Confidence must be downgraded when the user rejects output or when validation proves autonomy overestimated safety or quality.

Downgrade triggers:

- User rejects output.
- Validation fails.
- The same action fails repeatedly.
- Autonomy chose the wrong goal.
- Autonomy ignored or misread a preference.
- Execution required unplanned human repair.

Possible downgrade effects:

- Move future similar actions from execute mode to approval mode.
- Route similar goals to Review.
- Require dry-run before execution.
- Reduce retry allowance.
- Increase validation strictness.
- Add failure memory for the action type.

Confidence downgrade must be scoped. A rejected documentation edit should not automatically block unrelated task execution, but it should reduce confidence for similar documentation-generation actions.

## Audit Logs

Every autonomous action must be traceable. Audit logs are required before any production autonomy implementation.

Audit logs must answer:

- What goal was selected?
- Why was it selected?
- What plan was approved or executed?
- Which permission tier was active?
- Which memory entries influenced the decision?
- Which files, records, or external services were targeted?
- What action was taken?
- What validation was run?
- What changed?
- Who approved, paused, stopped, rerouted, rejected, or rolled back the action?
- Why did the run stop?

Minimum audit event fields:

- `eventId`
- `runId`
- `timestamp`
- `actor`: user, autonomy, validation, or system.
- `eventType`
- `permissionTier`
- `targetType`
- `targetId`
- `actionSummary`
- `decisionReason`
- `confidenceBefore`
- `confidenceAfter`
- `approvalState`
- `validationState`
- `stopReason`
- `relatedMemoryIds`

Audit event types:

- Goal selected.
- Plan created.
- Approval requested.
- Approval granted.
- Approval denied.
- Execution started.
- Execution completed.
- Validation passed.
- Validation failed.
- Pause requested.
- Stop requested.
- Reroute requested.
- Rollback requested.
- Output rejected.
- Confidence downgraded.
- Run completed.

Audit requirements:

- Logs must be append-only from the perspective of normal autonomy execution.
- Rollback must add compensating audit events rather than deleting history.
- Sensitive values must be redacted.
- Financial or API-heavy actions must include provider and quota/cost context when knowable.
- Audit logs must be inspectable before trusting autonomous completion claims.

## Permission Tiers

Permission tiers define the maximum autonomy behavior allowed for a run. The active tier must be recorded in every run and audit event.

### Observer Mode

Autonomy may inspect state and produce recommendations only.

Allowed:

- Read workflow state.
- Read intelligence signals.
- Read approved memory.
- Produce recommendations, explanations, and risk notes.
- Produce dry-run plans without side effects.

Not allowed:

- Mutate files or records.
- Execute tasks.
- Approve plans.
- Call external APIs.
- Commit, push, delete, or archive.

Best for:

- Initial setup.
- Low-trust or exploratory work.
- Reviewing recommendations.
- High-risk projects.

### Approval Mode

Autonomy may plan and request approval before each mutation.

Allowed:

- Everything in observer mode.
- Prepare executable steps.
- Request approval for a specific action.
- Execute only the approved action.
- Validate the approved action.

Not allowed:

- Continue to additional mutations without new approval.
- Infer approval from silence.
- Execute high-risk, destructive, financial, or API-heavy actions without explicit approval.

Best for:

- Early autonomy rollout.
- Documentation-to-implementation transition.
- Tasks with moderate risk.

### Semi-Autonomous Mode

Autonomy may execute low-risk, bounded actions without per-action approval, while pausing at defined checkpoints.

Allowed:

- Execute small, local, reversible actions.
- Validate after each step.
- Continue within recursion and retry limits.
- Stop at Review, destructive, financial, API-heavy, schema, dependency, and architecture checkpoints.

Not allowed:

- Bypass manual approval checkpoints.
- Execute destructive or high-cost actions.
- Approve Factory plans.
- Bulk-change workflow records.
- Continue after output rejection.

Best for:

- Stable local maintenance tasks.
- Narrow task execution with deterministic validation.
- Documentation and small UI polish after scope approval.

### Full Autonomous Mode

Full autonomous mode permits the widest execution envelope, but it still cannot override explicit safety gates.

Allowed:

- Execute approved categories of local tasks without per-step approval.
- Continue across multiple bounded steps within configured limits.
- Use memory and intelligence signals to select next safe work.
- Validate and report results.

Still requires approval:

- Destructive actions.
- Financial or API-heavy actions.
- External integrations.
- Secrets or permission changes.
- Schema changes.
- Dependency changes.
- Architecture expansion.
- Plan approval or Review bypass.
- Git force push, branch deletion, or history rewrite.

Best for:

- Mature workflows with stable tests.
- Narrow maintenance loops with strong audit logs.
- Post-review execution where the allowed action class is explicit.

Default recommendation:

- v1.7 should start in observer mode or approval mode.
- Semi-autonomous mode should require explicit user opt-in.
- Full autonomous mode should remain a future option gated by tests, audit logs, rollback paths, and explicit scope approval.

## Override Priority

When controls conflict, use this priority order:

1. Emergency stop.
2. Current explicit user instruction.
3. Manual approval checkpoint.
4. Project scope and safety docs.
5. Active permission tier.
6. Current workflow state.
7. Failsafe policy.
8. Memory.
9. Intelligence recommendation.

No permission tier may override emergency stop, explicit user instruction, approval checkpoints, or project scope.

## Minimum Acceptance Criteria

A future autonomy implementation is not acceptable unless:

- Users can pause, stop, reroute, and reject output.
- Approval checkpoints block execution before mutation.
- Permission tier is visible and recorded.
- Every autonomous action has an audit trail.
- Rejected output lowers confidence for similar future actions.
- Rollback behavior is explicit before high-risk execution.

