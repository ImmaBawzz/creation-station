# Visual Engine Migration Map

## Stable FFmpeg Render and Package Migration

| Source file | Destination file | Rewritten/Copied | Risk level | Remaining work |
| --- | --- | --- | --- | --- |
| `05_SCRIPTS/render/10_render_master_video.ps1` | `src/modules/visual-engine/render/renderProject.ts` | Rewritten | Medium | Expand from single primary visual source to multi-clip assembly and concat manifests. |
| `05_SCRIPTS/social/12_render_social_exports.ps1` | Not migrated yet | Deferred | Low | Add vertical and square export generation after base render path is stable. |
| `05_SCRIPTS/social/13_render_teasers.py` | Not migrated yet | Deferred | Low | Add teaser slicing only after final output packaging is stable. |
| `05_SCRIPTS/release/18_build_release_bundle.py` | `src/modules/visual-engine/export/packageProject.ts` | Rewritten | Low | Add archive creation and richer output selection if needed. |
| `05_SCRIPTS/release/17_write_release_report.py` | Not migrated yet | Deferred | Low | Add release report generation after final output variants exist. |
| `05_SCRIPTS/release/16_run_quality_gate.py` | Not migrated yet | Deferred | Medium | Port only post-render FFprobe validation when multiple output variants are added. |

## What Was Migrated

- Stable FFmpeg loop-and-merge logic for one primary image or video source.
- Audio attachment and final MP4 generation.
- Minimal package creation with `final.mp4` and `metadata.json`.
- Path handling rewritten to use `VISUAL_WORKSPACE_PATH` instead of repo-root hardcoded folders.
- `FFMPEG_PATH` and `FFPROBE_PATH` environment variable support.
- First successful end-to-end render test now uses real local demo assets, auto-detects supported audio and image files, writes `renders/final.mp4`, and packages `packages/demo-signal-fire.zip`.
- Post-render FFprobe quality checks now validate the produced `final.mp4` before packaging.
- Automated lyrics timing now writes `lyrics.json`, `lyrics.srt`, and `lyrics.ass`, with Whisper-backed word timestamps and ASS subtitle overlay when timings are available.

## What Was Explicitly Excluded

- ComfyUI workflows
- Image generation
- Video generation
- Lyrics timing logic
- Subtitle burn logic
- Soft subtitle muxing
- Old dashboard or UI files
- Experimental or checkpoint orchestration scripts
- Duplicate legacy manifests

## Remaining Work

- Multi-source timeline assembly.
- Extend subtitle burn to richer style controls and optional soft-subtitle muxing.
- Social format exports and teaser cuts.
- Post-render quality gates using FFprobe.
- Persisted render history on the project model once Prisma storage is added.
