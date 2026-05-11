# Creation Station v1.8 — Operator UX Pass

## Goal

Improve the operator cockpit around the stabilized core workflow without changing the underlying workflow engine.

v1.8 is not a v2/autonomy phase. It is a clarity, control, and usability phase.

## Current Foundation

v1.7.0-alpha stabilized:
- duplicate Factory submission prevention
- real IN_FACTORY workflow state
- rollback on planning failure
- revision-aware re-planning
- improved Review Inbox readability
- smoke tests
- deterministic full core workflow E2E coverage
- release documentation and QA notes

## v1.8 Scope

### 1. Workflow State Visibility

Improve how users understand where each idea/project/task currently sits.

Targets:
- clearer workflow badges
- better pending/revision/approved/failed visual language
- obvious Factory/Review/Task transitions
- no hidden state changes

### 2. Review Inbox Control Layer

Improve scanability and operator control.

Targets:
- filters for pending, revised, approved, failed, and stale plans
- better plan summary hierarchy
- stronger empty states
- clearer revision context display
- less visual noise in plan details

### 3. Task Board Organization

Make the task board usable as project volume grows.

Targets:
- group tasks by active, blocked, backlog, done, archived
- improve project/label filtering
- improve priority filtering
- make long task lists manageable
- preserve current task data model unless a minimal schema change is clearly justified

### 4. Activity / Event Log Foundation

Add an inspectable history layer for key workflow actions.

Targets:
- record important workflow events
- show what happened and when
- make future automation auditable
- keep this as an observer/logging layer, not autonomous execution

Candidate event types:
- idea_created
- sent_to_factory
- factory_plan_started
- factory_plan_failed
- factory_plan_created
- revision_requested
- plan_revised
- plan_approved
- tasks_created
- task_status_changed
- backup_exported

### 5. Operator Safety

Improve trust and recovery.

Targets:
- clearer notices
- clearer disabled button states
- safer retry messaging
- no duplicate submission regressions
- no silent destructive actions

## Explicit Non-Goals

v1.8 must NOT include:
- full autonomous execution loops
- multi-agent orchestration
- background self-running task engines
- v2 architecture rewrites
- broad database redesign
- unrelated visual redesign
- large dependency additions

## Suggested Implementation Order

1. Add/verify activity event model or lightweight event logging seam.
2. Add UI surface for recent activity.
3. Improve workflow badges and status labels.
4. Improve Review Inbox filters.
5. Improve Task Board grouping and empty states.
6. Add/extend tests.
7. Update QA docs.
8. Run full validation.

## Validation Requirements

Before merging v1.8 work:
- npm run test
- npm run lint
- npx tsc --noEmit
- npx prisma generate
- npm run test:smoke
- npx playwright test

## Test Requirements

Add or update tests for:
- workflow status badge rendering
- Review Inbox filtering
- Task Board grouping/filtering
- activity/event log creation if implemented
- no regression in full core workflow E2E

## Release Exit Criteria

v1.8 can be considered complete when:
- the user can quickly understand current workflow state
- Review Inbox is easier to scan and filter
- Task Board remains usable with growing task volume
- key workflow actions are visible in an activity/history surface
- all validation commands pass
- docs reflect actual repo behavior