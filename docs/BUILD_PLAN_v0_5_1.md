# Build Plan — Creation Station v0.5.1

## Strategy

One small improvement at a time.

Do not build new systems. Polish the existing system.

## Phase 0 — Safety

### Steps

1. Confirm current branch.

```powershell
git branch --show-current
git status
```

2. Create branch if needed.

```powershell
git checkout -b polish-v0-5-1
```

3. Confirm app still runs.

```powershell
npm install
npx prisma generate
npm run dev
```

4. Open:

```text
http://localhost:3000
```

5. Manually confirm the app loads.

## Phase 1 — Status Label Polish

### Goal

Replace technical enum display with human-readable labels and consistent badges.

### Tasks

- Create `src/lib/status-ui.ts`.
- Add helpers:
  - `statusLabel(status: string)`
  - `statusBadgeClass(status: string)`
  - `potentialLabel(potential: string)`
- Replace raw idea status display in `src/app/page.tsx`.
- Replace raw plan status display in `src/app/page.tsx`.
- Replace ugly `UNKNOWN` potential display where it dominates the UI.

### Acceptance

- `PLAN_READY` displays as `Plan Ready`.
- `TASKED` displays as `Tasks Created`.
- `NEEDS_REVISION` displays as `Needs Revision`.
- `REVISION_REQUESTED` displays as `Revision Requested`.
- Badges have consistent styling.

### Commit

```powershell
git add .
git commit -m "Polish status labels"
```

## Phase 2 — Empty States

### Goal

Every major panel tells the user what to do next when it has no content.

### Areas

- Idea Inbox
- Review Inbox
- Task Board columns
- Factory page idea list
- Factory recent plans

### Acceptance

Empty panels should answer:
- What is missing?
- What should the user do next?

### Commit

```powershell
git add .
git commit -m "Improve empty states"
```

## Phase 3 — Review/Revision Clarity

### Goal

Make it obvious what happens when a user requests a revision.

### Tasks

- Add helper copy near the revision textarea.
- Show previous revision notes clearly.
- Ensure "Request Revision" and "Re-plan with Feedback" do not appear in confusing places.
- Do not alter the data model unless absolutely required.

### Acceptance

The user can understand:
- The current plan is not final.
- Revision notes will be used for the next AI plan.
- Approval generates tasks.

### Commit

```powershell
git add .
git commit -m "Clarify revision flow"
```

## Phase 4 — Error Handling

### Goal

Make AI/Ollama failures understandable.

### Tasks

- Inspect `src/lib/aiProvider.ts`.
- Ensure connection/model/malformed JSON errors produce actionable messages.
- Do not expose large stack traces to UI unless in development mode.
- Add short troubleshooting text near Factory actions if helpful.

### Acceptance

If Ollama is off or the model is missing, the user gets a useful error message.

### Commit

```powershell
git add .
git commit -m "Improve AI planner error messages"
```

## Phase 5 — Manual Stability Test

Run the full test 3 times.

### Test Script

1. Create idea.
2. Send to Factory.
3. Review generated plan.
4. Request revision with notes.
5. Re-plan.
6. Approve.
7. Confirm tasks appear.

### Test Ideas

Use these:

```text
Test 1: Small Music Prompt Factory
A tool that converts emotional song ideas into structured Suno/Udio prompt packs.

Test 2: Mini Game Mechanic Brief
A game idea where a survival suit protects the player in dangerous heat zones.

Test 3: Visual Engine Checklist
A simple pipeline that turns a song, lyrics, and image prompt into a video production checklist.
```

### Commit

```powershell
git add .
git commit -m "Document v0.5.1 stability validation"
```

## Phase 6 — Stop

After phases 1–5, stop.

Do not begin v0.6 automatically.

Write report:

```text
docs/AGENT_RUN_REPORT.md
```
