# Changelog

## v1.2.1 - Task Metadata Hardening

### Added

- Explicit `Task.labels` metadata field for task-board labels.
- Serialized task labels for newly approved plan tasks.
- Backward-compatible task-board fallback labels for older tasks with empty label metadata.

### Changed

- Task-board label filters now prefer explicit task metadata before using legacy fallback grouping.

### Not Added

- New task models
- Label management UI
- External tagging systems
- Task logic rewrites
- Large schema redesign

## v1.0 — Release Polish

### Added

- First-use onboarding panel for empty workspaces.
- Release readiness checklist page.
- Shared navigation sidebar across core product pages.
- Wider export backup visibility from navigation sidebars and release checklist.
- v1.0 release documentation.

### Changed

- Removed locked future areas from the main navigation.
- Improved empty first-run guidance and release QA guidance.
- Tightened UI consistency across Inbox, Dashboard, Factory, Settings, and Release pages.

### Not Added

- Schema changes
- Authentication
- Teams
- Connectors
- Plugin systems
- Cloud sync
- Asset vault
- New AI systems

## v0.9 — Settings and AI Controls

### Added

- Settings route for local AI provider diagnostics.
- Current AI provider, Ollama model, base URL, and environment readiness display.
- Server-side AI connection test for local Ollama and the configured model.
- AI health messaging for setup and connection failures.
- Browser-local editable prompt presets used by Factory planning and revision prompts.

### Not Added

- Authentication
- Cloud accounts
- Team features
- Schema changes
- External connectors
- Plugin systems
- Asset vault

## v0.8 — Dashboard Overview

### Added

- Dashboard page with total ideas, ideas by status, plans waiting review, and tasks by status.
- Recent activity panels for ideas, approved plans, and tasks.
- Dashboard navigation from the existing Inbox and Factory Planner sidebars.

### Not Added

- Schema changes
- New dependencies
- Chart libraries
- Authentication
- Teams
- Connectors
- Plugin systems
- Asset vault

## v0.7 — Search, Filter, and Archive

### Added

- Idea Inbox search for titles, raw text, tags, and summaries.
- Status filter for existing idea statuses.
- Archived ideas are hidden from the main inbox by default.
- Archived view toggle for reviewing archived ideas.

### Not Added

- Schema changes
- New dependencies
- Authentication
- Teams
- Connectors
- Asset vault
- Advanced search syntax

## v0.6 — Asset Visibility

### Added

- Clear required-asset lists with counts in Review Inbox.
- Clear required-asset lists with counts on the Factory Planner latest plans.
- Small asset need cues on task cards using each task's source plan.

### Not Added

- Asset vault
- File uploads
- Asset storage
- Asset database models
- External asset connectors

## v0.5.2 — Export Backup

### Added

- Local JSON export route for all Ideas, FactoryPlans, and Tasks.
- Export Backup button on the home UI.
- Backup metadata with `generatedAt` and `appVersion`.

### Not Added

- Prisma schema changes
- Authentication
- Cloud storage
- Asset vault
- Connectors
- New AI features

## v0.5.1 — Stabilization

### Added

- Stabilization documentation
- Agent autopilot instructions
- QA test plan
- Build plan
- PRD for stabilization

### Changed

- Pending agent work:
  - Status label polish
  - Empty state polish
  - Review/revision clarity
  - AI planner error clarity

### Not Added

- Agents
- Connectors
- Asset vault
- Meetings
- Automation engine
- Plugin system
