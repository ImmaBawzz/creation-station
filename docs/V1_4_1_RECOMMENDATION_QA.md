# Creation Station v1.4.1 Recommendation QA

Date: 2026-05-06

Scope: tune deterministic recommendation scoring, harden automation prompt assumptions, and re-run one full lifecycle QA idea for each pipeline.

## Baseline Recommendation

Before v1.4.1 tuning, the recommendation panel showed:

1. Review the waiting plan: `Factory Plan: Test local AI planner`
2. Work this next: `Capture a basic test idea using the Creation Station`

This was stable but over-weighted older pending/generic work compared with fresh pipeline momentum.

## Scoring Changes

- Added scored recommendation candidates instead of append-only ordering.
- Added next-task scoring for priority, task age, active project momentum, blocker impact, and stale penalties.
- Added context grouping so one project cannot fill the recommendation panel before other useful signals.
- Preserved existing recommendation types and UI shape.

## Automation Routing Changes

The Automation pipeline prompt guidance now distinguishes:

- Local automation
- API automation
- Infrastructure automation
- AI tooling automation

Local automation guidance explicitly avoids cloud services, external APIs, and credential assumptions unless the idea asks for them.

## QA Records

| Pipeline | Idea | Result |
| --- | --- | --- |
| Music | V1.4.1 QA Music - Glass City Chorus Pack | Passed |
| Visual | V1.4.1 QA Visual - Ember Arcade Poster Loop | Passed |
| Game | V1.4.1 QA Game - Relay Ruins UEFN Prototype | Passed |
| Automation | V1.4.1 QA Automation - Local Markdown Checklist CLI | Passed |

## QA Results

- Classification: all four records appeared under the correct idea and task pipeline filters.
- Factory: all four plans generated compatible JSON through the existing local Ollama flow.
- Task generation: all four plans approved into 20 total tasks.
- Automation prompt quality: passed. The generated automation plan stayed local-first and listed Markdown input, checklist template, CLI script, validation fixtures, and documentation.
- Recommendation quality after tuning: improved. The panel now surfaces `Define the CLI script structure and basic commands` ahead of the older pending review plan because it is fresh active automation work with project momentum.
- Export integrity: passed. `/api/export` includes four v1.4.1 ideas, four plans, 20 related tasks, and the existing `taskBlockers` array.

## Stability Finding

The expanded QA task set exposed a task-board rendering issue: every task card rendered a blocker dropdown containing every task in the board. This could exhaust the Next.js dev server heap after repeated QA records.

Fix: task cards now receive lightweight task references, and add-blocker candidates are scoped to the same plan context. Existing blocker display remains intact.

## Readiness

v1.4.1 is ready for v1.5 foundation work. Remaining recommendation improvements should stay deterministic and avoid schema expansion until a concrete persisted override is needed.
