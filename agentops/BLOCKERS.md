# Blockers

Last updated: 2026-05-11T20:20:44Z

## Active

- Direct `npx prisma db push` still exits with a Prisma schema-engine error for local SQLite URLs, even though `npx prisma validate` and `npx prisma generate` pass.
- `v1.7.0-alpha.2` must not be tagged or published until the release-prep PR is reviewed and a separate release approval is given.
- GitHub Actions CI must rerun after the npm 10 `package-lock.json` synchronization fix; the first PR runs failed at `npm ci`.

## Watch

- Remote history cleanup for `dev.db` completed and was verified from a fresh clone. The `v1.6.0` GitHub source archive was downloaded after tag rewrite and contained no database artifacts.
- Release prep PR #1 is open; wait for CI rerun and review before any merge, tag, or release action.
- `C:\Users\Shadow\Documents\AIProjects\CreationStation\creation-station-pre-db-cleanup.bundle` preserves pre-cleanup history and is sensitive because it contains the former `dev.db` history.
- `.codex/.codex/` is untracked and was not modified.
- Existing Turbopack NFT tracing warnings remain tied to the music-video builder import trace.
- `npm audit` reports 7 dependency findings, 5 moderate and 2 high, after a clean install; remediation is deferred unless required for release approval.
- External publishing, analytics import, affiliate, sponsorship, and payment integrations require credentials and explicit approval before implementation.
