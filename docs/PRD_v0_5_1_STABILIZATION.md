# PRD — Creation Station v0.5.1 Stabilization

## Product Name

Creation Station

## Version

v0.5.1 — Stabilization & Product Polish

## Objective

Turn the already-working v0.5 prototype into a stable, understandable local creative workflow tool.

The product must reliably support:

Idea → AI Factory Plan → Review → Revision → Approval → Tasks

## Background

Creation Station is a local-first creative project management app. It captures raw ideas, sends them through an AI Factory Planner, lets the user review or revise plans, and converts approved plans into actionable tasks.

The current v0.5 build already includes:
- AI Factory Planner using local Ollama
- Dedicated Factory page
- Structured prompt builder
- Review Inbox
- Revision notes
- Context-aware re-planning
- Dynamic task generation from AI next actions
- Kanban-like task board

## Problem

The app works, but still feels partially like a developer prototype:
- Status values are technical.
- Empty states may be unclear.
- Error states may be too raw.
- Review/revision flow needs clearer guidance.
- The user needs confidence that the core loop is reliable before expanding.

## Target User

A solo multidisciplinary creator who captures many ideas across:
- Music
- Video
- Film
- Games
- AI systems
- Visual art
- Product concepts
- Worldbuilding

The user wants to turn raw ideas into structured plans and tasks without losing creative momentum.

## Non-Goals

This version must not implement:
- Multi-agent meetings
- External connectors
- Plugin/mod system
- Asset vault as a major module
- Authentication
- Team features
- Cloud sync
- ComfyUI/VSCode/GitHub automation
- Deployment

## Functional Requirements

### FR1 — Idea Inbox Remains Stable

The user can:
- Create a new idea.
- Set title, raw text, category, and tags.
- See ideas in the inbox.
- See clear status labels.

### FR2 — AI Factory Planner Remains Stable

The user can:
- Send eligible ideas to the Factory.
- Generate an AI plan.
- Store the plan.
- See plan details.

### FR3 — Review Inbox Is Clear

The user can:
- See generated plans waiting for review.
- Read summary, concept, required assets, risks, and next actions.
- Approve a plan.
- Request revision with notes.

### FR4 — Revision Loop Is Clear

The user can:
- Add revision feedback.
- See stored revision feedback.
- Re-plan the idea using previous plan context and notes.

### FR5 — Task Generation Works

The user can:
- Approve a plan.
- Generate tasks from `plan.nextActions`.
- See generated tasks on the task board.

### FR6 — UI Polish

The app should show:
- Human-readable status labels.
- Consistent badges.
- Useful empty states.
- Clear next-step guidance.
- No confusing raw enum labels unless appropriate for debugging.

## Acceptance Criteria

The version is accepted when:

- [ ] `npm run lint` passes or known warnings are documented.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx prisma generate` passes.
- [ ] The local app starts with `npm run dev`.
- [ ] User can create idea.
- [ ] User can create AI plan.
- [ ] User can request revision.
- [ ] User can re-plan.
- [ ] User can approve plan.
- [ ] Tasks are generated and visible.
- [ ] No scope-locked features were added.

## Success Metric

The core loop works three times in a row without code changes or manual database fixes.
