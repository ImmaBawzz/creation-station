# Blockers

Last updated: 2026-05-11T19:52:28Z

## Active

- Release preparation for `v1.7.0-alpha.2` is stopped until remote history cleanup is approved and completed. Local reachable history has been rewritten with `git-filter-repo` and now has no `dev.db` entries, but GitHub remote branches/tags and existing release archives still need an explicit owner-approved force-push/tag rewrite.
- Direct `npx prisma db push` still exits with a Prisma schema-engine error for local SQLite URLs, even though `npx prisma validate` and `npx prisma generate` pass.

## Watch

- `C:\Users\Shadow\Documents\AIProjects\CreationStation\creation-station-pre-db-cleanup.bundle` preserves pre-cleanup history and is sensitive because it contains the former `dev.db` history.
- `.codex/.codex/` is untracked and was not modified.
- Existing Turbopack NFT tracing warnings remain tied to the music-video builder import trace.
- External publishing, analytics import, affiliate, sponsorship, and payment integrations require credentials and explicit approval before implementation.
