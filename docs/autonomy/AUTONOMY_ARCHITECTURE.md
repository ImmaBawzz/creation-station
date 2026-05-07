# Creation Station v1.7 Autonomy Architecture

Status: Architecture documentation only. No production code is defined or implemented here.

## Purpose

v1.7 autonomy is a bounded execution architecture for turning approved local workflow signals into safe, repeatable next actions. It extends the existing Idea Inbox -> Factory Planner -> Review -> Tasks workflow and the v1.6 deterministic intelligence layer without introducing external agents, cloud services, background connectors, or schema changes by default.

The autonomy layer must remain local-first, explainable, reversible where possible, and subordinate to existing user-controlled workflow gates.

## Scope

Autonomy may:

- Inspect existing ideas, plans, reviews, tasks, blockers, and intelligence recommendations.
- Select a single approved or eligible goal.
- Build a bounded plan for the next smallest safe action.
- Execute only actions explicitly allowed by policy.
- Validate the result using deterministic checks.
- Stop when confidence, safety, or completion conditions require it.

Autonomy must not:

- Create new product direction without user approval.
- Bypass Review, approval, or task ownership gates.
- Change database schema without a separate approved migration plan.
- Add dependencies or external services without explicit approval.
- Run indefinitely or retry without limits.
- Delete user data, branches, backups, or history.

## System Position

```text
Idea Inbox
  -> Factory Planner
  -> Review
  -> Tasks
  -> Intelligence Layer
  -> Autonomy Kernel
  -> Validation
  -> Existing workflow surfaces
```

The autonomy kernel consumes the workflow state and intelligence output. It does not replace the workflow. It only proposes or performs bounded actions that the current workflow already supports.

## Interaction Model

### Idea Inbox

The Idea Inbox remains the source of raw creative intent. Autonomy may read inbox records to identify stale, high-confidence, or unprocessed ideas, but it must not silently invent missing requirements.

Allowed interactions:

- Detect candidate ideas for routing.
- Recommend sending a high-confidence idea to Factory.
- Flag invalid or incomplete ideas for user clarification.
- Use idea status, age, tags, and text as goal context.

Approval checkpoints:

- If an idea has ambiguous intent, low route confidence, or missing required context, autonomy must route to human review.
- If processing the idea would create a new workflow type, autonomy must stop.

### Factory Planner

The Factory Planner remains the planning boundary between idea intake and executable work. Autonomy may use existing Factory plans as structured goals and may request planning only when the action is already supported and safe.

Allowed interactions:

- Select an existing plan awaiting review or tasking.
- Identify a plan that needs revision.
- Convert approved plan next actions into task candidates through existing actions.
- Use existing pipeline metadata and plan fields as execution context.

Approval checkpoints:

- Autonomy must not approve its own plan output.
- Autonomy must not rewrite plan scope without review.
- Any plan with high risk, missing requirements, or external dependency assumptions must be routed to human review.

### Review

Review is the human quality gate. Autonomy treats review state as authoritative and must not collapse review into execution.

Allowed interactions:

- Surface plans waiting for review.
- Detect revision requests and route them back to planning.
- Stop execution when review is pending.
- Produce concise context for why review is needed.

Approval checkpoints:

- Human approval is required before plan approval, destructive action, schema change, dependency change, architecture expansion, or external integration.
- Low-confidence recommendations must become review items, not autonomous actions.

### Tasks

Tasks are the safest execution unit. Autonomy should prefer existing tasks over raw ideas or plans because tasks are smaller, user-visible, and already scoped.

Allowed interactions:

- Select one next task using status, priority, blockers, age, and dependency signals.
- Move through a bounded task execution attempt only when the action is reversible and clearly defined.
- Mark execution as blocked or failed when validation fails.
- Create follow-up notes or recommended next steps when direct execution is unsafe.

Approval checkpoints:

- Autonomy must not archive, delete, or bulk-complete tasks without approval.
- Blocked tasks require blocker handling or user input before execution.
- Tasks that imply data migration, dependency installation, secrets, external services, or architecture changes require human approval.

### Intelligence Layer

The v1.6 intelligence layer remains deterministic advisory logic. Autonomy consumes intelligence output as signal, not command.

Allowed interactions:

- Use route confidence, stale-work detection, blocker health, next-task ranking, and recommendation reason codes.
- Combine intelligence signals with failsafe policy before execution.
- Record why an intelligence recommendation was accepted, deferred, or rejected.

Boundaries:

- Intelligence does not execute actions.
- Autonomy does not mutate intelligence output.
- Hidden module-level memory must not influence recommendations or execution.

## Core Components

### Goal Intake

Goal intake normalizes one target from user intent, idea state, plan state, task state, or intelligence recommendation.

Required fields:

- `goalId`
- `goalType`
- `source`
- `summary`
- `currentState`
- `expectedOutcome`
- `constraints`
- `approvalState`

### Planner

The planner decomposes the selected goal into the smallest safe executable step. It must prefer a one-step plan when the goal is narrow.

Plan output:

- Selected step
- Inputs required
- Expected state change
- Validation method
- Rollback or recovery note
- Stop conditions

### Execution Kernel

The execution kernel runs the goal -> plan -> execute -> validate -> repeat -> stop loop defined in [EXECUTION_KERNEL_SPEC.md](./EXECUTION_KERNEL_SPEC.md).

The kernel owns limits, state transitions, confidence gates, and emergency stop handling.

### Memory Adapter

The memory adapter provides explicit, typed context from short-term memory, task memory, failure memory, and preference memory. It is defined in [MEMORY_MODEL.md](./MEMORY_MODEL.md).

Memory must be inspectable and scoped. It must not silently override current workflow state.

### Failsafe Controller

The failsafe controller enforces recursion limits, retry limits, confidence thresholds, human approval checkpoints, and emergency stop behavior. It is defined in [FAILSAFE_PROTOCOLS.md](./FAILSAFE_PROTOCOLS.md).

### Validation Harness

Validation checks whether the action achieved the expected outcome and whether any stop condition was triggered.

Validation may include:

- TypeScript or lint checks when code changes are involved.
- Database state checks when existing server actions are used.
- UI workflow checks when user-facing behavior changes.
- Documentation completeness checks for planning-only work.

## State Machine

```text
IDLE
  -> GOAL_SELECTED
  -> PLAN_READY
  -> EXECUTING
  -> VALIDATING
  -> COMPLETED

VALIDATING
  -> PLAN_READY       when another bounded iteration is safe
  -> NEEDS_REVIEW     when human approval or clarification is required
  -> BLOCKED          when a dependency, blocker, or invalid state prevents progress
  -> FAILED           when execution or validation fails within retry limits
  -> STOPPED          when a failsafe or emergency stop is triggered
```

No transition may skip `VALIDATING`.

## Data Ownership

Autonomy reads from existing local records and derived intelligence signals. Any future writes must use existing application actions or separately approved persistence contracts.

Default v1.7 documentation position:

- No schema change.
- No new background runner.
- No external connector.
- No hidden memory store.
- No autonomous approval.

## Observability

Every autonomy run should produce a compact run record before production implementation is considered.

Minimum run record fields:

- Goal source and selected goal.
- Plan step.
- Execution attempt count.
- Validation result.
- Stop reason.
- Human approval requirement, if any.
- Memory entries read or written.

## Acceptance Criteria For Future Implementation

A future implementation may begin only after these docs are reviewed and the implementation scope is approved.

Minimum implementation readiness criteria:

- Execution loop contract is stable.
- Memory read/write boundaries are explicit.
- Failsafe thresholds are selected.
- Test scenarios are mapped to automated or manual checks.
- Human approval checkpoints are wired into existing Review/task surfaces.

