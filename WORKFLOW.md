# Development Workflow

## How To Choose The Next Best Step

1. Read `ROADMAP.md` first.
2. Find the current completed milestone and the current active milestone.
3. Choose the smallest adjacent step that moves the active milestone forward.
4. Prefer the step that can be validated quickly.
5. Do not skip ahead to distant roadmap work unless the current milestone is blocked.

## When To Continue Automatically

Continue automatically when all of these are true:

- the next step is on the roadmap
- the next step is adjacent to the current completed work
- the next step is safe and local
- the next step does not require a new product decision
- the next step can be validated in a focused way

## When To Stop And Ask

Stop and ask when any of these are true:

- the next step is ambiguous
- the work would be destructive or risky
- the roadmap and reality no longer match
- the user needs to choose between materially different product directions
- the current milestone is fully complete

## Validation After Each Slice

After each meaningful implementation slice, do the narrowest useful validation first:

1. behavior check for the changed flow
2. narrow test for the touched area
3. lint, typecheck, or build for the touched project
4. review-only fallback when no executable validation exists

Do not widen scope before that first focused validation unless blocked.

## Implementation Closeout Format

End each implementation with these four parts:

1. What changed
2. What was verified
3. What remains blocked, if anything
4. The reminder block

## Reminder Template

- Next Best Step: one concrete adjacent task
- Why This Is Next: one short reason
- Resume Trigger: one short sentence that tells the next pass exactly where to continue

## Example Closeout

What changed:
- Added the Ollama-backed Factory Planner and saved AI-generated plans into review.

What was verified:
- Lint passed.
- Build passed.
- A real AI-generated plan was saved and displayed in the review flow.

What remains blocked:
- Nothing blocked for the current milestone.

Reminder:
- Next Best Step: approve an AI-generated plan and verify task creation all the way through
- Why This Is Next: planning now works, so the next risk is the downstream approval path
- Resume Trigger: continue with the latest AI-generated review item and validate its approval-to-task flow
