# Lyric Video Test Workflow

This workflow is a controlled MVP test for the full lyric music video pipeline. It takes one audio file, one lyrics file, optional visual source media, predefined scene settings, lyric overlay settings, and renders one MP4 plus a basic log.

It does not call external AI video systems. If no usable clips or start image are provided, the runner creates safe placeholder scenes with colored motion backgrounds so the end-to-end render can still be tested.

## Folder Structure

```text
input/
  audio/
  lyrics/
  images/
  video_clips/
output/
  renders/
  logs/
  temp/
config/
scripts/
workflows/
```

The script creates these folders if they are missing.

## Required Inputs

Place files at the paths configured in `config/lyric_video_test_workflow.json`:

- Audio: `input/audio/test_song.mp3`
- Lyrics: `input/lyrics/test_lyrics.txt`
- Optional start image: set `start_image` to a file under `input/images/`
- Optional source clips: put `.mp4`, `.mov`, `.mkv`, `.webm`, `.m4v`, or `.avi` files in `input/video_clips/`

The default `visual_source` is `auto`: scene-specific clips are used first, then a scene image or configured start image, then clips from `input/video_clips/`, then generated placeholders. Set it to `placeholder` when you want a deterministic no-media smoke test.

Plain `.txt` lyrics are supported first. Put one lyric line per line. If the file has no timestamps, the runner distributes lines evenly across the audio duration.

Basic `.lrc` timestamped lyrics are also supported when lines use timestamps like:

```text
[00:12.50]First lyric line
[00:17.20]Second lyric line
```

## How To Run

From the project root:

```powershell
python scripts/run_lyric_video_workflow.py
```

To use a different config:

```powershell
python scripts/run_lyric_video_workflow.py --config config/lyric_video_test_workflow.json
```

FFmpeg must be installed and `ffmpeg` plus `ffprobe` must be available on `PATH`.

## Expected Output

For the default project name, the runner writes:

```text
output/renders/creation_station_mvp_lyric_video_test.mp4
output/logs/creation_station_mvp_render_log.txt
output/temp/creation_station_mvp/
```

The rendered video matches the full audio duration, uses multiple scene segments, applies lower-third lyric subtitles, combines the final video with the input audio, and avoids black-frame-only visuals.

## Known Limitations

- Scene durations are evenly distributed across the song.
- Scene transitions are hard cuts for this MVP.
- Placeholder visuals are functional test scenes, not final creative output.
- Plain text lyrics use automatic line timing, not word-level karaoke timing.
- Subtitle rendering uses FFmpeg's ASS subtitle support.
- Only MP4 export is supported.

## Next Upgrade Steps

- Replace placeholder scenes with ComfyUI, Kling, Veo, LTX, or start-frame-to-video clips.
- Add beat-synced scene switching.
- Add karaoke-style word timing and animated lyric emphasis.
- Add Spotify-style lyric motion presets.
- Add optional crossfades after scene timing is stable.
- Add an FFmpeg-only fast path for production batches.
