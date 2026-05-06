# Creation Station v1.4 Pipeline QA

Date: 2026-05-06

Scope: create one real idea for each v1.4 pipeline and run each through Idea -> Factory -> Review -> Task generation -> Task board -> Intelligence layer -> Export.

## Records Created

| Pipeline | Idea | Result |
| --- | --- | --- |
| Music | V1.4 QA Music - Neon Rain Ambient Single | Passed |
| Visual | V1.4 QA Visual - Lunar Tea Product Teaser | Passed |
| Game | V1.4 QA Game - Storm Courier UEFN Island | Passed |
| Automation | V1.4 QA Automation - Release Checklist Generator | Passed |

## Validation

- Classification: all four ideas appeared under the expected pipeline filters and task-board filters.
- Factory: all four ideas generated compatible JSON plans through the existing Ollama Factory flow.
- Review: all four plans appeared in Review Inbox and approved successfully.
- Task generation: approval created 20 total tasks across the four plans.
- Intelligence: recommendation panel remained stable and showed pipeline counts.
- Export: `/api/export` returned all four QA ideas, four plans, 20 related tasks, and the existing `taskBlockers` collection.

## A. Failures

- No blocking lifecycle failures.
- The browser console retained older dev-server errors from earlier schema/client drift, but a fresh reload after QA showed zero new errors or warnings.

## B. Friction Points

- Factory generation gives little progress feedback during the Ollama wait.
- Review Inbox can be dominated by older pending plans, so new pipeline QA plans require scrolling or careful visual targeting.
- The recommendation panel prioritized older waiting work instead of newly created pipeline tasks, which is logically valid but less useful during pipeline QA.

## C. Duplicate Logic

- The new pipeline registry owns category aliases, but the New Idea category dropdown is still hardcoded in the page UI.
- Task labels remain generic and are assigned by action index, not pipeline definition defaults.

## D. Unclear UX

- Pipeline classification is visible after creation, but the New Idea form does not preview the detected route before saving.
- Task-board pipeline filtering works, but task cards do not expose a compact pipeline badge near the task title.
- Recommendation copy does not explain why pipeline counts changed after the QA run.

## E. Pipeline-Specific Improvements

- Music: generated plan covered song concept, prompt pack, production notes, cover art, and release prep well.
- Visual: generated plan covered prompt variants, render workflow, review, and social export well.
- Game: generated plan covered design brief, UEFN setup, implementation, playtest, and release notes well.
- Automation: generated plan stayed workflow-oriented, but included "API credentials for integration testing"; future prompt guidance should discourage credential assumptions for local-first tools.

## Status

v1.4 modular pipeline foundation passed the full lifecycle QA. Do not add module-specific workspaces until the friction points above are reviewed.
