# Artifact Policy

## Purpose

This repository keeps source code, curated fixtures, and lightweight demo structure in git. Generated runtime outputs, debug files, local workspace state, and ad hoc stress-test assets stay local unless they are intentionally promoted into a maintained fixture set.

## What Belongs In Git

- Application source code under `src/`, `scripts/`, Prisma schema and migrations, and committed docs.
- Registered workflow definitions such as `src/modules/comfy/workflows/*.json`.
- Lightweight demo project structure under `visual-workspace/projects/demo-signal-fire/`.
- Required manifests that define a committed demo fixture, including `visual-workspace/projects/demo-signal-fire/project.json`.
- Curated text fixtures only when they are intentionally part of a repeatable demo or test flow.
- `.gitkeep` files used to preserve required empty directories.

## What Must Stay Local

- `.debug/` outputs, including workflow validation state and Comfy history dumps.
- Local editor task state such as `.vscode/tasks.json`.
- Comfy-generated images written into `visual-workspace/projects/<project>/images/`.
- Rendered videos written into `visual-workspace/projects/<project>/renders/`.
- Packaged outputs written into `visual-workspace/projects/<project>/packages/`.
- Local audio and video drops written into project `audio/` and `video/` folders.
- Temporary stress-test projects created for one-off validation unless they are explicitly promoted.

## What Gets Regenerated

- Comfy workflow validation/debug state under `.debug/`.
- Imported or generated images under project `images/` folders.
- Render outputs such as `.mp4` and `.mov` files.
- Package outputs such as `.zip` bundles.
- Local audio/video artifacts used during manual or smoke-test runs.

## Visual Workspace Rules

`visual-workspace/` is a working area, not a blanket fixture directory.

- Keep the committed `demo-signal-fire` project as the lightweight demo fixture.
- Preserve its empty-folder structure with `.gitkeep` files in `audio/`, `images/`, `lyrics/`, `renders/`, `packages/`, and `video/`.
- Keep `project.json` only when the project is intentionally part of the committed demo fixture set.
- Do not commit new per-run outputs into demo project folders just because they were produced locally.

## Comfy-Generated Images

- Images produced by Comfy smoke tests or local generation runs stay local by default.
- If an image is needed as a permanent fixture, move it into an explicitly curated fixture location and document why it is committed.
- Do not grow the tracked `visual-workspace/projects/demo-signal-fire/images/` set opportunistically.

## Render And Package Outputs

- Render outputs and package bundles are generated deliverables and must stay local.
- These outputs should be reproducible from project inputs and application code.
- If a release artifact must be shared, publish it outside git rather than storing it in the repository.

## Debug Outputs

- Debug output is for diagnosis only and must not be committed.
- Examples include Comfy workflow state, validation dumps, prompt history snapshots, and similar runtime traces.

## Current Tracked Fixture Decision

The repository keeps only the lightweight demo fixture surface under `visual-workspace/projects/demo-signal-fire/` in git:

- `project.json`
- `.gitkeep` files for required folders
- `lyrics/signal_fire_ui_smoke_lyrics.txt`

Audio files, images, renders, packages, and generated lyrics byproducts for demo or stress-test runs stay local and are not part of the committed fixture set.

If a future test needs committed media-like inputs, promote them deliberately into a dedicated curated fixture location with explicit rationale rather than letting `visual-workspace/` accumulate generated artifacts.

## Stress-Test Projects

Projects such as `clean-vocals-test`, `melodic-vocals-test`, and `hard-vocals-test` are treated as local stress-test workspaces unless they are explicitly promoted into a curated fixture directory.

- Promotion path: move lightweight manifests and tiny text inputs into `tests/fixtures/visual-engine/`, exclude large media and generated outputs, and document why the fixture is stable and worth versioning.

## Ambiguous Files

- Do not delete ambiguous local files automatically.
- If a file is not clearly generated and not clearly part of a curated fixture set, leave it local and call it out during review.
- Examples include one-off stress-test reports, local project manifests for ad hoc experiments, and copied lyrics text files that have not been promoted into a formal fixture set.