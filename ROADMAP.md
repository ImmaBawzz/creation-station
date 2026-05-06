# Creation Station Roadmap

## Roadmap Rules

1. `ROADMAP.md` is the source of truth for staged progress.
2. Continue to the next best roadmap step automatically unless blocked, complete, unsafe, or redirected by the user.
3. Every completed implementation should end with a short reminder that names the next best step.
4. Finish validation for the current slice before jumping to a distant milestone.
5. Update this roadmap when a milestone gate is satisfied so future work does not rely on memory alone.

## Current Status

- Current stable baseline: `v1.1.0`
- Current completed milestone: `v1.1`
- Current next planning milestone: `v1.5`
- Current working branch: `feature/v1.5-task-separation`
- Current next best step: harden the v1.5 foundation from the `v1.1.0` baseline before adding more app behavior.

Baseline notes:
- `v1.1-rc.1` remains the release-candidate QA tag.
- `v1.1.0` is the stable baseline tag for v1.5 planning and implementation.
- `planning/v1.5-system-organization` contains the accepted planning document.
- `feature/v1.5-task-separation` contains early task-board organization work and should be treated as the active v1.5 foundation branch until redirected.

## Next Planning Phases

### v1.5 - System Organization and Task-Board Scalability

Goal: make the existing local-first workflow easier to operate as the number of ideas, plans, and tasks grows.

Allowed direction:
- Improve organization, grouping, filters, labels, and compact task-board views.
- Preserve existing task data and workflow behavior.
- Keep changes small and reviewable.
- Prefer clarity and reliability over new product surface.

Non-goals:
- No new automation engine.
- No external connectors.
- No plugin system.
- No full asset vault.
- No major architecture rewrite.

### v2.0 - Deeper AI/Product Architecture

Goal: explore deeper AI and product architecture only after v1.5 organization work is planned and stable.

Planning guardrails:
- Do not begin v2.0 implementation from the v1.1 baseline without a separate plan.
- Any new subsystem, schema expansion, provider architecture, or agent-like behavior requires explicit approval.
- Keep the v1.1 core workflow intact as the baseline.

## v0.2 - AI Factory Planner

Goal: Replace the rule-based Factory plan generator with an Ollama-powered planner and give it a dedicated Factory page.

Included scope:
- Ollama-backed factory planning
- dedicated Factory Planner page
- prompt builder and AI provider layer
- inline success and error guidance
- saved AI-generated plans flowing into review

Excluded scope:
- plan-aware task generation
- revision feedback loop
- asset tracking
- autonomous execution agents

Implementation steps:
1. Add `factoryPrompt.ts` and `aiProvider.ts`.
2. Replace the hardcoded factory plan logic in the server action.
3. Add the Factory Planner route and navigation.
4. Add beginner-friendly setup and inline error handling.
5. Verify real local generation through Ollama.

Verification gates:
1. Lint passes.
2. Build passes.
3. A real AI-generated plan is saved to the database.
4. The saved plan appears in the Review Inbox.

Next best step:
- Move to `v0.3` and validate the approval path for AI-generated plans all the way through task creation.

Completion notes:
- Review Inbox shows `nextActions`, colored status badge, and conditional action buttons.
- Idea Inbox guards "Send to Factory" by idea status; shows "Plan in Review" and "Tasks Created" badges.
- Removed dead intermediate `Idea: APPROVED` assignment in `approvePlan`.

## v0.3 - AI Approval Flow Validation

Goal: Prove that AI-generated plans survive the full approval flow without regressions in status transitions, review behavior, or task creation.

Included scope:
- approve one or more AI-generated plans
- verify status transitions from `PLAN_READY` to `APPROVED` to `TASKED`
- verify tasks are created correctly for AI-generated plans
- tighten review messaging if the flow feels unclear

Excluded scope:
- redesigning task generation logic
- adding revision comments or chat

Implementation steps:
1. Approve an AI-generated plan and verify the current task creation path.
2. Confirm idea, plan, and task states stay consistent.
3. Improve review or approval messaging if any part of the flow is confusing.
4. Capture any approval-flow gaps that block structured task generation.

Verification gates:
1. An AI-generated plan can be approved successfully.
2. Tasks are created from the approved AI plan.
3. Status transitions remain consistent across idea and plan records.
4. Review UI stays understandable after approval.

Next best step:
- Replace hardcoded task titles with plan-aware task generation in `v0.4`.

Completion notes:
- All v0.3 verification gates satisfied.
- Review UI updated; status transitions consistent.

## v0.4 - Structured Task Generation

Goal: Generate tasks from the actual approved plan content instead of a fixed hardcoded list.

Included scope:
- derive task titles and descriptions from plan content
- improve task descriptions and priorities
- keep human approval in place before tasks are created

Excluded scope:
- autonomous task execution
- multi-agent workflow orchestration

Implementation steps:
1. Define a structured task output shape.
2. Update approval flow to create tasks from plan content.
3. Add validation that task generation remains readable and useful.
4. Verify the task board reflects plan-aware tasks.

Verification gates:
1. Approved plans create non-hardcoded tasks.
2. Tasks reflect plan content clearly.
3. Task creation remains stable in the existing workflow.

Next best step:
- Add revision feedback and re-plan support in `v0.5`.

Completion notes:
- `approvePlan` now parses `plan.nextActions` (newline-split) into individual task titles.
- Falls back to 5 hardcoded titles only if AI returns no usable lines.
- Task description now uses `plan.summary` instead of a generic string.

## v0.5 - Revision and Re-Plan Loop

Goal: Let users request revision with feedback and regenerate a better plan from that feedback.

Included scope:
- revision reason capture
- re-plan flow using feedback
- clear display of latest revision state

Excluded scope:
- chat-based planning assistant
- full revision history explorer

Implementation steps:
1. Capture revision feedback in the UI and action layer.
2. Re-run planning with prior plan plus user feedback.
3. Mark latest revision clearly for review.
4. Verify the review queue stays understandable.

Verification gates:
1. Revision requests include usable feedback.
2. A revised plan can be generated and reviewed.
3. Status flow remains consistent.

Next best step:
- Add asset and dependency tracking in `v0.6`.

Completion notes:
- `requestRevision` now accepts and persists `revisionNotes`.
- Review Inbox shows an inline textarea for revision feedback before submitting.
- REVISION_REQUESTED plans display stored revision notes in an orange callout.
- NEEDS_REVISION ideas show a "Re-plan with Feedback" button in the Idea Inbox.
- `sendToFactory` detects the most recent REVISION_REQUESTED plan and passes its content + notes to the AI.
- `buildFactoryPrompt` conditionally injects prior plan context and reviewer feedback into the prompt.
- `FactoryPlan.revisionNotes` field added to schema via `prisma db push`.

## v0.6 - Asset and Workflow Expansion

Goal: Track required assets and improve visibility across all workflow stages.

Included scope:
- asset placeholders
- dependency or resource tracking
- clearer stage-to-stage workflow visibility

Excluded scope:
- production or publishing automation

Implementation steps:
1. Model or represent required assets more clearly.
2. Surface asset needs alongside plans and tasks.
3. Improve cross-stage UI visibility.
4. Verify the workflow remains easy to follow.

Verification gates:
1. Assets are visible and actionable.
2. Workflow stages show clearer continuity.
3. Added tracking does not make the UI confusing.

Next best step:
- Introduce guided automation hooks in `v0.7`.

## v0.7 - Guided Execution Layer

Goal: Add guided agent or automation assistance while keeping humans in control.

Included scope:
- optional guided automation actions
- stronger workflow guardrails
- limited agent-assisted task advancement

Excluded scope:
- fully autonomous publishing
- unattended execution chains

Implementation steps:
1. Define where guidance is useful and safe.
2. Add limited automation hooks for selected tasks.
3. Keep state transitions explicit and reviewable.
4. Verify guardrails before expanding automation.

Verification gates:
1. Guided actions are clear and reversible.
2. Users still understand what happened and why.
3. Automation does not bypass review discipline.

Next best step:
- Connect production and publishing steps in `v0.8`.

## v0.8 - Production Pipeline

Goal: Extend the workflow into production readiness and execution tracking.

Included scope:
- production states
- execution checklist
- artifact readiness tracking

Excluded scope:
- final release hardening and polish

Implementation steps:
1. Add production-oriented states.
2. Track readiness for execution and output artifacts.
3. Connect tasks to production progression.
4. Verify the end-to-end workflow still reads clearly.

Verification gates:
1. Production states are coherent.
2. Readiness tracking is visible and actionable.
3. The workflow can move from idea to production without ambiguity.

Next best step:
- Harden UX, validation, and docs in `v0.9`.

## v0.9 - Product Hardening

Goal: Improve reliability, clarity, and usability before the MVP release.

Included scope:
- validation improvements
- clearer messaging
- UX polish
- docs and regression checks

Excluded scope:
- major feature expansion

Implementation steps:
1. Tighten validation and edge-case handling.
2. Improve user guidance and copy.
3. Run regression-oriented checks across the core workflow.
4. Update docs to match the stable workflow.

Verification gates:
1. Core flows are stable and understandable.
2. Docs match the actual product behavior.
3. Validation catches common failure modes.

Next best step:
- Define and satisfy final MVP criteria in `v1.0`.

## v1.0 - Complete Creative Ops MVP

Goal: Ship a stable idea-to-plan-to-task workflow with revision support, structured task generation, roadmap discipline, and clear operating guidance.

Included scope:
- stable creative workflow from inbox through tasks
- revision and re-plan support
- structured task generation
- roadmap-driven development system
- docs and verification discipline

Release criteria:
1. Core workflow is stable end to end.
2. Task generation reflects plan content.
3. Revision loop exists and is understandable.
4. Roadmap and workflow docs are accurate and current.
5. Future work can continue from the roadmap without re-explaining the process.

Next best step:
- After `v1.0`, decide whether the product should deepen automation, collaboration, or publishing.
