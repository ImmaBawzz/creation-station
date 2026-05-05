# Changelog

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
