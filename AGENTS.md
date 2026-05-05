<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Creation Station Workflow Rules

## Source Of Truth

1. Read `ROADMAP.md` before choosing what to do next.
2. Treat `ROADMAP.md` as the source of truth for staged progress.
3. Use `WORKFLOW.md` for the implementation checklist and closeout format.
4. Use session memory for temporary in-flight context only, not for long-term sequencing.

## Default Continuation Rule

1. Continue to the next best roadmap step automatically when the current one is complete, adjacent, and unblocked.
2. Do not wait for repeated user nudges when the next local step is already clear.
3. Validate the current slice before moving to the next roadmap step.
4. Stop continuation only for blockers, destructive risk, unresolved product ambiguity, or explicit user redirect.

## Current Roadmap Position

- Current completed milestone: `v0.5`
- Current active milestone: `v0.6`
- Current next best step: model required assets more clearly and surface them alongside plans and tasks.

## Closeout Requirement

Every implementation closeout should include:

1. What changed
2. What was verified
3. What remains blocked, if anything
4. A short reminder block with:
	- `Next Best Step:`
	- `Why This Is Next:`
	- `Resume Trigger:`

## Reminder Rule

Always end implementation by naming the next best adjacent roadmap step so future work naturally continues from the correct place.

## Repo-Specific Guardrails

1. Keep changes aligned to the current roadmap milestone unless validation or user input changes the path.
2. Prefer small validated slices over broad speculative expansion.
3. If roadmap and reality diverge, update the roadmap instead of silently drifting away from it.
4. When working on Next.js behavior, follow the warning above and check the local Next.js docs when needed.
