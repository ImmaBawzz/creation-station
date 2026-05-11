# Creation Station

Creation Station is a local-first creator workflow app for turning raw ideas into reviewed plans, executable tasks, production packets, and manually prepared publish-ready content.

It is a creator workflow control room for moving from idea -> plan -> task -> content brief -> production packet -> publish-ready prep while keeping publishing, metrics, monetization, and advanced automation under manual control.

## Current Status

- `v1.7.0-alpha.2` candidate
- Creator Run v0.1
- Internal/private creator pre-release
- Not a full public platform release

`v1.6.0` remains the stable public release line. The Creator Run work is staged as an alpha pre-release for validation, not as a stable platform launch.

## What It Does

- Capture raw ideas.
- Generate and review Factory Plans.
- Request revisions before execution.
- Approve plans into executable tasks.
- Manage a local task board.
- Create content items.
- Build content briefs.
- Save draft versions.
- Create Production Packets.
- Prepare music briefs.
- Prepare image prompts.
- Prepare video assembly plans.
- Prepare publishing targets.
- Record manual metrics snapshots.
- Track monetization notes manually.

## What It Does Not Do Yet

- No direct publishing.
- No imported analytics.
- No payment processing.
- No affiliate API integration.
- No autonomous media generation.
- No guaranteed revenue.
- No public-ready advanced automation.

Creation Station does not post to creator platforms, import verified platform analytics, process money, run affiliate APIs, or promise content performance.

## Core Workflows

Core planning workflow:

```text
Idea -> FactoryPlan -> Review/Revision -> Task
```

Manual content workflow:

```text
ContentItem -> ContentBrief -> ContentDraft -> Production Packet -> PublishingTarget -> ContentMetric -> MonetizationLink
```

Publishing remains manual. Metrics are user-entered snapshots. Monetization values are notes and tracking only, not payment processing or financial reporting.

## Creator Run v0.1

Creator Run v0.1 is an internal/private workflow bridge for turning one content item into a production-ready planning packet and manual task sequence.

```text
Idea -> plan -> content brief -> production packet -> music brief -> image prompts -> video plan -> manual publish -> manual metrics
```

The Production Packet is deterministic and local. It can organize a music brief, image prompts, video assembly plan, publishing prep, and follow-up tasks without calling external music, image, video, publishing, analytics, payment, or affiliate providers.

## Local-First Setup

Creation Station uses:

- Next.js App Router
- React
- TypeScript
- Prisma
- SQLite
- Optional local Ollama for local AI planning
- Deterministic `AI_PROVIDER=test` path for repeatable tests

Local state is stored in SQLite. Keep local databases out of Git.

## Quick Start

Install dependencies:

```bash
npm install
```

Create a local `.env.local` file. Safe local defaults:

```env
DATABASE_URL="file:./dev.db"
AI_PROVIDER="test"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3.1"
```

Generate Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

For local Ollama planning, set `AI_PROVIDER=ollama`, start Ollama, and configure `OLLAMA_MODEL` to a model available on your machine. Do not use `npx prisma db push` as a release validation step while the known schema-engine/db-push issue remains open.

## Validation

Run:

```bash
npx prisma generate
npx prisma validate
npx tsc --noEmit
npm run lint
npm test
npm run build
```

CI uses the deterministic test provider and does not require external provider credentials.

## Release Strategy

Creation Station uses staged release exposure:

1. Internal
2. Private creator
3. Invite beta
4. Public MVP
5. Partner/agency
6. Advanced automation
7. Full platform

The current Creator Run v0.1 work belongs to the internal/private creator stage. Public MVP exposure must stay limited to public-safe manual workflows until route-level, API-level, and server-action gates are hardened.

## Repository Hygiene

- Do not commit local database files.
- Do not commit generated media.
- Do not commit `.env` files.
- Do not commit local input/output folders.
- Do not commit Playwright reports or test artifacts.
- Keep pre-cleanup bundles private.
- Use `.env.example` for safe placeholders only.

Ignored local files include `*.db`, `*.sqlite`, `*.sqlite3`, `.env*`, generated outputs, local inputs, build artifacts, and test reports.

## Current Limitations

- Route-level, API-level, and server-action gates still need hardening.
- Public MVP subfeature visibility still needs refinement.
- Monetization controls must stay private/beta-safe.
- Advanced automation remains gated and deferred.
- Direct publishing, imported analytics, payment APIs, affiliate APIs, and autonomous media generation remain out of scope.

## License And Status

This repository currently does not include a license file. Treat it as all rights reserved unless a license is added later.

The package is marked private in `package.json`; the current release target is an internal/private alpha pre-release, not a public stable platform launch.
