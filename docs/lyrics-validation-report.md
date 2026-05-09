# Lyrics Validation Report

## Test Asset Used

- Project: `demo-signal-fire`
- Audio: `visual-workspace/projects/demo-signal-fire/audio/signal_fire_ui_smoke.mp3`
- Source lyrics: `visual-workspace/projects/demo-signal-fire/lyrics/signal_fire_ui_smoke_lyrics.txt`
- Visual source: `visual-workspace/projects/demo-signal-fire/images/signal_fire_ui_smoke_start_image.png`
- Subtitle artifacts generated:
  - `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.json`
  - `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.srt`
  - `visual-workspace/projects/demo-signal-fire/lyrics/lyrics.ass`

## Timestamp Quality

- Validation was run against a real local Whisper-compatible endpoint hosted temporarily on `127.0.0.1:8765` using a local Whisper model.
- Word timestamp generation succeeded on the full demo audio and produced a complete subtitle artifact set.
- Accuracy was materially better with the stronger local model than with the initial base pass.
- The generated source-lyric line timings are usable for render validation, but they are not yet production-perfect.
- Observed remaining timing defects in the raw subtitle artifacts:
  - some line windows still hold too long across musical gaps
  - some chorus-adjacent lines start slightly early or end slightly late
  - line-to-word alignment remains imperfect for sung vocals, especially in repeated sections

## Subtitle Quality

- Final render validation used the generated subtitle pipeline on the real demo audio and burned subtitles into `final.mp4`.
- Visual inspection of extracted frames confirmed:
  - subtitle placement is centered and consistently above the bottom edge
  - subtitle readability is good against the current image background due to strong outline and contrast
  - no sampled overlap was observed in the final rendered frames
  - mobile-safe vertical margins appear acceptable in sampled frames
- Visible subtitle text in the sampled render frames matched the intended lyric lines in the early section, chorus section, and later section that were checked.

## Render Quality

- The render pipeline completed successfully with subtitles enabled.
- FFprobe quality checks passed for the rendered output:
  - video stream present
  - audio stream present
  - final duration aligned with audio duration within tolerance
  - output resolution remained `1920x1080`
- Sampled rendered frames confirmed that the subtitle burn-in path is functioning under real media conditions.

## Remaining Issues

- Raw subtitle timing still needs tighter line-level alignment for sung lyrics before this should be treated as fully production-ready for arbitrary music assets.
- The karaoke-oriented ASS artifact still inherits limitations from Whisper word timing accuracy on music vocals.
- A dedicated alignment pass between source lyrics and transcribed timing anchors would improve repeated chorus timing and reduce long holds.