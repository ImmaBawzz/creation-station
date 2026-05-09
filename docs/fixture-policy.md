# Fixture Policy

## Purpose

Fixtures are small, deterministic repository assets that support repeatable development, smoke checks, and tests. `visual-workspace/` is primarily a local working area, so only the minimum fixture surface needed for a stable demo should remain in git.

## What Counts As A Fixture

- `project.json` files for intentionally curated demo projects.
- `.gitkeep` files that preserve required empty folders.
- Tiny text inputs such as a stable sample lyric file when it is intentionally used as a demo or test input.
- Project-level README or workspace documentation that explains the fixture layout.

## What Counts As Generated Local Media

- Audio files such as `.mp3` and `.wav`.
- Images such as `.png`, `.jpg`, and `.jpeg`.
- Render outputs such as `.mp4` and `.mov`.
- Package outputs such as `.zip`.
- Generated lyrics artifacts such as `lyrics.json`, `lyrics-aligned.json`, `lyrics.srt`, and `lyrics.ass` unless they are explicitly promoted as golden fixtures.

These files stay local and must not be committed from `visual-workspace/projects/`.

## Demo Project Representation

The committed demo project is `visual-workspace/projects/demo-signal-fire/`.

Allowed in git for that demo project:

- `project.json`
- `audio/.gitkeep`
- `images/.gitkeep`
- `lyrics/.gitkeep`
- `renders/.gitkeep`
- `packages/.gitkeep`
- `video/.gitkeep`
- `lyrics/signal_fire_ui_smoke_lyrics.txt`

Not allowed in git for that demo project:

- audio media files
- image files
- render outputs
- package outputs
- generated lyrics JSON/SRT/ASS files

The demo manifest should remain valid as a lightweight scaffold and must not depend on committed generated media.

## Stress-Test Projects

`clean-vocals-test`, `melodic-vocals-test`, and `hard-vocals-test` are currently treated as local stress-test workspaces.

- Keep them local.
- Do not commit their media outputs.
- Do not commit their ad hoc manifests or copied lyric text from `visual-workspace/projects/`.
- If they need to become official fixtures, move curated lightweight copies into `tests/fixtures/visual-engine/` and strip all large media.

## Current Classification

### A. Required Lightweight Fixture

- `visual-workspace/projects/README.md`
- `visual-workspace/projects/demo-signal-fire/project.json`
- `visual-workspace/projects/demo-signal-fire/audio/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/images/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/lyrics/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/packages/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/renders/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/video/.gitkeep`
- `visual-workspace/projects/demo-signal-fire/lyrics/signal_fire_ui_smoke_lyrics.txt`

### B. Generated Media Artifact

- `visual-workspace/projects/demo-signal-fire/audio/signal_fire_ui_smoke.mp3`
- `visual-workspace/projects/demo-signal-fire/images/signal_fire_ui_smoke_start_image.png`
- `visual-workspace/projects/demo-signal-fire/images/demo-signal-fire-concept-1778326703140_00001_.png`
- `visual-workspace/projects/demo-signal-fire/renders/final.mp4`
- `visual-workspace/projects/demo-signal-fire/packages/demo-signal-fire.zip`
- `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.json`
- `visual-workspace/projects/demo-signal-fire/lyrics/lyrics-aligned.json`
- `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.srt`
- `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.ass`
- `visual-workspace/projects/clean-vocals-test/audio/clean_vocals_test.mp3`
- `visual-workspace/projects/clean-vocals-test/images/signal_fire_ui_smoke_start_image.png`
- `visual-workspace/projects/clean-vocals-test/packages/clean-vocals-test.zip`
- `visual-workspace/projects/clean-vocals-test/renders/final.mp4`
- `visual-workspace/projects/clean-vocals-test/lyrics/lyrics.json`
- `visual-workspace/projects/clean-vocals-test/lyrics/lyrics-aligned.json`
- `visual-workspace/projects/clean-vocals-test/lyrics/lyrics.srt`
- `visual-workspace/projects/clean-vocals-test/lyrics/lyrics.ass`
- `visual-workspace/projects/hard-vocals-test/audio/hard_vocals_test.mp3`
- `visual-workspace/projects/hard-vocals-test/images/signal_fire_ui_smoke_start_image.png`
- `visual-workspace/projects/hard-vocals-test/packages/hard-vocals-test.zip`
- `visual-workspace/projects/hard-vocals-test/renders/final.mp4`
- `visual-workspace/projects/hard-vocals-test/lyrics/lyrics.json`
- `visual-workspace/projects/hard-vocals-test/lyrics/lyrics-aligned.json`
- `visual-workspace/projects/hard-vocals-test/lyrics/lyrics.srt`
- `visual-workspace/projects/hard-vocals-test/lyrics/lyrics.ass`
- `visual-workspace/projects/melodic-vocals-test/audio/melodic_vocals_test.mp3`
- `visual-workspace/projects/melodic-vocals-test/images/signal_fire_ui_smoke_start_image.png`
- `visual-workspace/projects/melodic-vocals-test/packages/melodic-vocals-test.zip`
- `visual-workspace/projects/melodic-vocals-test/renders/final.mp4`
- `visual-workspace/projects/melodic-vocals-test/lyrics/lyrics.json`
- `visual-workspace/projects/melodic-vocals-test/lyrics/lyrics-aligned.json`
- `visual-workspace/projects/melodic-vocals-test/lyrics/lyrics.srt`
- `visual-workspace/projects/melodic-vocals-test/lyrics/lyrics.ass`

### C. Local Test-Only Asset

- `visual-workspace/projects/clean-vocals-test/project.json`
- `visual-workspace/projects/clean-vocals-test/lyrics/signal_fire_ui_smoke_lyrics.txt`
- `visual-workspace/projects/hard-vocals-test/project.json`
- `visual-workspace/projects/hard-vocals-test/lyrics/signal_fire_ui_smoke_lyrics.txt`
- `visual-workspace/projects/melodic-vocals-test/project.json`
- `visual-workspace/projects/melodic-vocals-test/lyrics/signal_fire_ui_smoke_lyrics.txt`

### D. Stress-Test Fixture Candidate

- None currently promoted. If stress-test coverage needs to become repeatable in CI, curate a reduced fixture set under `tests/fixtures/visual-engine/`.

### E. Needs Explicit Decision

- None in `visual-workspace/projects/` after the current classification pass.

## Why Generated Media Must Not Be Committed

- It expands repository size quickly without improving source control value.
- It mixes deterministic source inputs with per-run outputs.
- It creates noisy diffs from local smoke tests and validation runs.
- It makes fixture intent unclear because generated assets look like required repo inputs.
- It is better handled as local runtime state or promoted deliberately into a dedicated curated fixture area.