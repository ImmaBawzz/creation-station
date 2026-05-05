# QA Test Plan — Creation Station v0.5.1

## Purpose

Validate the stable core workflow.

## Commands

Run these before manual testing:

```powershell
npm run lint
npx tsc --noEmit
npx prisma generate
npm run dev
```

## Manual Test A — Basic Idea to Task

### Input

Title:

```text
QA Test — Idea to Task
```

Raw idea:

```text
A test idea to verify that a raw creative concept can become an AI plan, enter review, be approved, and generate tasks.
```

Category:

```text
Product Ideas
```

Tags:

```text
qa, core-loop, stability
```

### Expected

- Idea appears in Idea Inbox.
- Sending to Factory creates a plan.
- Plan appears in Review Inbox.
- Approving creates tasks.
- Tasks appear under TODO.

## Manual Test B — Revision Loop

### Input

Title:

```text
QA Test — Revision Loop
```

Raw idea:

```text
A small creative tool that turns one messy idea into a clean one-page project brief.
```

Revision notes:

```text
Make this smaller, more practical, and focused on the first useful MVP only.
```

### Expected

- Plan can enter revision state.
- Revision notes are saved.
- Re-plan uses revision notes.
- New or updated plan is reviewable.
- Approval still creates tasks.

## Manual Test C — Task Generation From nextActions

### Expected

- Tasks are created from AI-generated `nextActions`.
- If nextActions has usable lines, hardcoded fallback tasks should not dominate.
- Task descriptions include plan summary/context.

## UI Checks

- Status labels are human-readable.
- Badges are readable.
- Review Inbox explains what to do next.
- Empty states are useful.
- No scary raw stack traces in normal UI.

## Regression Checks

Confirm these still work:
- `src/app/actions.ts`
- `src/lib/aiProvider.ts`
- `src/lib/factoryPrompt.ts`
- `src/app/factory/page.tsx`
- `src/app/page.tsx`
- Prisma client generation

## Pass Criteria

The system passes when the full workflow works 3 consecutive times without manual database repair.
