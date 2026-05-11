# Blockers

Last updated: 2026-05-11T19:20:20Z

## Active

- Release preparation for `v1.7.0-alpha.2` is stopped because `dev.db` was tracked in this public repository and exists in prior Git history with local workflow records. The file has been removed from tracking in the current branch, but history cleanup or explicit owner acceptance is required before creating a pre-release tag or GitHub release.
- Direct `npx prisma db push` still exits with a Prisma schema-engine error for local SQLite URLs, even though `npx prisma validate` and `npx prisma generate` pass.

## Watch

- `.codex/.codex/` is untracked and was not modified.
- Existing Turbopack NFT tracing warnings remain tied to the music-video builder import trace.
- External publishing, analytics import, affiliate, sponsorship, and payment integrations require credentials and explicit approval before implementation.
