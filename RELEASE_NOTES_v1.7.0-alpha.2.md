# Creation Station v1.7.0-alpha.2 — Creator Run v0.1

## Status

Pre-release / internal-private alpha.

This is not a full public platform release. It is an alpha focused on validating a stable local-first creator workflow for internal/private creator use.

## Highlights

- Added staged release planning.
- Added feature gating foundation.
- Added manual content pipeline support.
- Added Creator Run v0.1.
- Added Production Packet generation for content items.
- Added production task creation from content workflow.
- Added Markdown export for Production Packets.
- Completed repository history cleanup for the tracked `dev.db` blocker.
- Fixed clean-checkout CI validation by synchronizing the lockfile for npm 10, making dynamic API route context types explicit, and making the FFprobe-dependent final assembly test deterministic.

## Creator Run v0.1 Flow

```text
Idea -> Plan -> Content item -> Brief -> Production Packet -> Music brief -> Image prompts -> Video plan -> Publishing prep -> Manual publish -> Manual metrics
```

Creator Run v0.1 is manual-first and local-first. It does not call external media generators, publishing APIs, analytics imports, payment APIs, affiliate APIs, or autonomous execution systems.

## Intentionally Deferred

- External music generation providers
- External image generation providers
- External video generation providers
- Direct publishing APIs
- Imported analytics
- Payment APIs
- Affiliate APIs
- Autonomous execution
- Public platform exposure

## Known Gaps

- Route/API/server-action gate hardening still needs work before public MVP exposure.
- Public MVP subfeature visibility still needs refinement.
- Monetization control visibility must remain private/beta-safe.
- Advanced automation remains gated.
- Branch protection still needs to be enabled after CI is stable.

## Validation

Validated locally in this release-prep cycle:

- `npx npm@10.8.2 ci` - passed after synchronizing `package-lock.json` for the CI npm version; npm reported 7 audit findings, 5 moderate and 2 high, not remediated in this alpha prep cycle
- `npx prisma generate` - passed
- `npx prisma validate` - passed
- `npx tsc --noEmit` - passed
- `npm run lint` - passed with 16 existing warnings
- `npm test` - passed, 49 files and 303 tests
- `npx vitest run src/modules/final-assembly/index.test.ts` - passed, 1 test
- `npm run build` - passed with 4 known Turbopack/NFT tracing warnings from the music-video builder import trace
- Unsafe tracked file scan - passed, no output

## Repository Hygiene

- `dev.db` was removed from tracked and remote reachable history.
- A fresh remote clone returned no database artifact output.
- The `v1.6.0` source archive was verified clean after the tag rewrite.
- A local ignored `dev.db` may still exist for development.
- The pre-cleanup bundle is sensitive and must remain private.
- The initial PR CI runs failed at `npm ci` due to lockfile drift under the CI npm version; `package-lock.json` was synchronized with `npx npm@10.8.2 install --package-lock-only` before continuing release prep.
- A later PR CI run failed at `npx tsc --noEmit` because clean checkouts do not have generated Next route context globals before build; the affected API routes now define explicit local context types.
- A later PR CI run failed at `npm test` because the final assembly FFprobe test depended on runner-local FFprobe availability; the test now uses the Node executable as a deterministic non-FFprobe command and `FFPROBE_PATH` is read at call time.

## Release Boundaries

- Do not publish `v1.7.0` stable.
- Do not mark this alpha as a full public platform release.
- Keep `v1.6.0` as the current stable release unless a separate release decision changes that.
