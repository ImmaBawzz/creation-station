from __future__ import annotations

import argparse
import array
import json
import math
import re
import shutil
import subprocess
import textwrap
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT / "config" / "lyric_video_test_workflow.json"

INPUT_DIRS = (
    ROOT / "input" / "audio",
    ROOT / "input" / "lyrics",
    ROOT / "input" / "images",
    ROOT / "input" / "video_clips",
)
OUTPUT_DIRS = (
    ROOT / "output" / "renders",
    ROOT / "output" / "logs",
    ROOT / "output" / "temp",
)

SUPPORTED_VIDEO_EXTENSIONS = {".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"}
SUPPORTED_IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
LRC_TIMESTAMP_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]")
SECTION_HEADER_RE = re.compile(r"^\[([A-Za-z][A-Za-z0-9 -]{0,40})\]$")
SAFE_PROJECT_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")

SECTION_WEIGHTS = {
    "intro": 0.07,
    "verse": 0.22,
    "pre-chorus": 0.12,
    "chorus": 0.18,
    "verse 2": 0.20,
    "final chorus": 0.28,
    "outro": 0.07,
}


class WorkflowError(RuntimeError):
    pass


@dataclass(frozen=True)
class LyricLine:
    text: str
    start: float
    end: float
    section: str = "Lyrics"
    confidence: float = 0.5


@dataclass(frozen=True)
class LyricTimingResult:
    audio_analysis: "AudioAnalysis | None"
    detected_sections: list[str]
    lines: list[LyricLine]
    mode: str


@dataclass(frozen=True)
class AudioAnalysis:
    beat_times: list[float]
    chorus_zones: list[tuple[float, float]]
    energy_change_times: list[float]
    intro_silence_end: float
    likely_vocal_zones: list[tuple[float, float]]
    summary: str


@dataclass(frozen=True)
class SceneSegment:
    index: int
    name: str
    start: float
    end: float
    color: str
    accent_color: str
    source_kind: str
    source_path: Path | None

    @property
    def duration(self) -> float:
        return max(0.1, self.end - self.start)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the controlled lyric music video MVP workflow.",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to a workflow JSON config. Defaults to config/lyric_video_test_workflow.json.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config/assets and write lyric timing preview without rendering the final video.",
    )
    args = parser.parse_args()

    ensure_folder_structure()

    config_path = resolve_path(args.config)
    config: dict[str, Any] | None = None
    log_lines: list[str] = []

    try:
        config = load_config(config_path)
        project_name = get_project_name(config)
        output_paths = build_output_paths(project_name, config)
        output_paths["render_path"].parent.mkdir(parents=True, exist_ok=True)
        output_paths["log_path"].parent.mkdir(parents=True, exist_ok=True)

        require_binary("ffprobe")
        require_binary("ffmpeg")

        audio_path = required_repo_path(config, "audio_file")
        lyrics_path = required_repo_path(config, "lyrics_file")
        validate_required_inputs(audio_path, lyrics_path)

        width, height = parse_resolution(config)
        fps = positive_int(config.get("fps"), "fps")
        validate_output_format(config)
        validate_optional_visual_inputs(config)

        audio_duration = inspect_audio_duration(audio_path)
        audio_analysis = analyze_audio_for_timing(audio_path, audio_duration, config)
        lyric_timing = parse_lyrics(lyrics_path, audio_duration, audio_analysis)
        lyrics = lyric_timing.lines
        scenes = prepare_scene_timing(config, audio_duration)

        temp_dir = output_paths["temp_dir"]
        temp_dir.mkdir(parents=True, exist_ok=True)
        timing_preview_path = write_timing_preview(project_name, lyrics)

        if args.dry_run:
            log_lines = build_render_log(
                status="DRY_RUN",
                config_path=config_path,
                config=config,
                audio_path=audio_path,
                lyrics_path=lyrics_path,
                audio_duration=audio_duration,
                lyric_timing=lyric_timing,
                scenes=scenes,
                output_path=output_paths["render_path"],
                timing_preview_path=timing_preview_path,
                error_message=None,
            )
            output_paths["log_path"].write_text("\n".join(log_lines) + "\n", encoding="utf-8")
            print(f"Dry-run validation complete: {display_path(config_path)}")
            print(f"Timing preview: {display_path(timing_preview_path)}")
            print(f"Render log: {display_path(output_paths['log_path'])}")
            return 0

        ass_path = temp_dir / f"{project_name}_lyrics.ass"
        visuals_path = temp_dir / f"{project_name}_visuals.mp4"
        scene_paths = render_scene_clips(config, scenes, temp_dir, width, height, fps)
        concatenate_scene_clips(scene_paths, visuals_path, temp_dir)

        subtitle_path = None
        if bool(config.get("lyric_overlay_enabled", True)):
            subtitle_path = write_ass_subtitles(
                ass_path=ass_path,
                lyrics=lyrics,
                width=width,
                height=height,
                font_settings=config.get("font", {}),
            )

        render_final_video(
            config=config,
            visuals_path=visuals_path,
            audio_path=audio_path,
            subtitle_path=subtitle_path,
            output_path=output_paths["render_path"],
        )

        log_lines = build_render_log(
            status="SUCCESS",
            config_path=config_path,
            config=config,
            audio_path=audio_path,
            lyrics_path=lyrics_path,
            audio_duration=audio_duration,
            lyric_timing=lyric_timing,
            scenes=scenes,
            output_path=output_paths["render_path"],
            timing_preview_path=timing_preview_path,
            error_message=None,
        )
        output_paths["log_path"].write_text("\n".join(log_lines) + "\n", encoding="utf-8")

        print(f"Render complete: {display_path(output_paths['render_path'])}")
        print(f"Render log: {display_path(output_paths['log_path'])}")
        return 0
    except WorkflowError as exc:
        error_message = str(exc)
        print(f"Workflow failed: {error_message}")
        if config is not None:
            write_failure_log(config_path, config, error_message)
        return 1


def ensure_folder_structure() -> None:
    for folder in (*INPUT_DIRS, *OUTPUT_DIRS, ROOT / "config", ROOT / "scripts", ROOT / "workflows"):
        folder.mkdir(parents=True, exist_ok=True)


def resolve_path(path_value: str) -> Path:
    path = Path(path_value)
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


def repo_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path.resolve()
    return (ROOT / path).resolve()


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def load_config(config_path: Path) -> dict[str, Any]:
    if not config_path.exists():
        raise WorkflowError(f"Config file not found: {display_path(config_path)}")
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WorkflowError(f"Config JSON is invalid at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def get_project_name(config: dict[str, Any]) -> str:
    project_name = str(config.get("project_name", "")).strip()
    if not project_name:
        raise WorkflowError("Config field 'project_name' is required.")
    if not SAFE_PROJECT_NAME_RE.fullmatch(project_name):
        raise WorkflowError(
            "Config field 'project_name' must use only letters, numbers, underscores, or hyphens, "
            "and must start with a letter or number."
        )
    return project_name


def build_output_paths(project_name: str, config: dict[str, Any] | None = None) -> dict[str, Path]:
    output_file = optional_string((config or {}).get("output_file", ""))
    render_path = repo_path(output_file) if output_file else ROOT / "output" / "renders" / f"{project_name}_lyric_video_test.mp4"
    log_path = ROOT / "output" / "logs" / f"{project_name}_render_log.txt"
    temp_dir = ROOT / "output" / "temp" / project_name
    return {
        "render_path": render_path,
        "log_path": log_path,
        "temp_dir": temp_dir,
    }


def require_binary(binary_name: str) -> None:
    if shutil.which(binary_name) is None:
        raise WorkflowError(
            f"Required command '{binary_name}' was not found on PATH. Install FFmpeg and make sure "
            f"'{binary_name}' is available before running this workflow."
        )


def required_repo_path(config: dict[str, Any], field_name: str) -> Path:
    value = str(config.get(field_name, "")).strip()
    if not value:
        raise WorkflowError(f"Config field '{field_name}' is required.")
    return repo_path(value)


def validate_required_inputs(audio_path: Path, lyrics_path: Path) -> None:
    missing = []
    if not audio_path.exists():
        missing.append(f"audio_file: {display_path(audio_path)}")
    if not lyrics_path.exists():
        missing.append(f"lyrics_file: {display_path(lyrics_path)}")
    if missing:
        joined = "\n- ".join(missing)
        raise WorkflowError(f"Missing required input files:\n- {joined}")


def validate_optional_visual_inputs(config: dict[str, Any]) -> None:
    start_image = optional_string(config.get("start_image", ""))
    if start_image:
        start_image_path = repo_path(start_image)
        if not start_image_path.exists():
            raise WorkflowError(f"Configured start_image does not exist: {display_path(start_image_path)}")
        if start_image_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
            raise WorkflowError(f"Configured start_image is not a supported image file: {display_path(start_image_path)}")

    for index, scene in enumerate(config.get("scenes", []), start=1):
        if not isinstance(scene, dict):
            raise WorkflowError(f"Scene {index} must be an object.")
        for field_name, supported_extensions in (
            ("source_clip", SUPPORTED_VIDEO_EXTENSIONS),
            ("source_image", SUPPORTED_IMAGE_EXTENSIONS),
        ):
            source_value = optional_string(scene.get(field_name, ""))
            if not source_value:
                continue
            source_path = repo_path(source_value)
            if not source_path.exists():
                raise WorkflowError(f"Scene {index} {field_name} does not exist: {display_path(source_path)}")
            if source_path.suffix.lower() not in supported_extensions:
                raise WorkflowError(f"Scene {index} {field_name} has an unsupported file type: {display_path(source_path)}")


def parse_resolution(config: dict[str, Any]) -> tuple[int, int]:
    resolution = config.get("resolution", {})
    if isinstance(resolution, dict):
        width = positive_int(resolution.get("width"), "resolution.width")
        height = positive_int(resolution.get("height"), "resolution.height")
    elif isinstance(resolution, list) and len(resolution) == 2:
        width = positive_int(resolution[0], "resolution[0]")
        height = positive_int(resolution[1], "resolution[1]")
    elif isinstance(resolution, str) and "x" in resolution.lower():
        width_value, height_value = resolution.lower().split("x", 1)
        width = positive_int(width_value, "resolution width")
        height = positive_int(height_value, "resolution height")
    else:
        raise WorkflowError("Config field 'resolution' must be an object with width/height or a string like '1920x1080'.")

    if width < 320 or height < 180:
        raise WorkflowError("Resolution must be at least 320x180.")
    return width, height


def positive_int(value: Any, field_name: str) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise WorkflowError(f"Config field '{field_name}' must be a positive integer.") from exc
    if number <= 0:
        raise WorkflowError(f"Config field '{field_name}' must be a positive integer.")
    return number


def non_negative_int(value: Any, field_name: str) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise WorkflowError(f"Config field '{field_name}' must be a non-negative integer.") from exc
    if number < 0:
        raise WorkflowError(f"Config field '{field_name}' must be a non-negative integer.")
    return number


def optional_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def validate_output_format(config: dict[str, Any]) -> None:
    output_format = str(config.get("output_format", "mp4")).lower().strip()
    if output_format != "mp4":
        raise WorkflowError("This MVP workflow currently supports output_format 'mp4' only.")


def inspect_audio_duration(audio_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    result = run_command(command, description="Inspect audio duration")
    try:
        duration = float(result.stdout.strip())
    except ValueError as exc:
        raise WorkflowError(f"Could not parse audio duration from ffprobe output: {result.stdout.strip()}") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise WorkflowError(f"Audio duration must be positive. ffprobe returned {duration!r}.")
    return duration


def analyze_audio_for_timing(
    audio_path: Path,
    audio_duration: float,
    config: dict[str, Any],
) -> AudioAnalysis | None:
    timing_settings = config.get("timing", {})
    if isinstance(timing_settings, dict) and timing_settings.get("audio_analysis_enabled") is False:
        return None

    sample_rate = 11_025
    frame_seconds = 0.25
    frame_size = max(1, int(sample_rate * frame_seconds))
    command = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(audio_path),
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "s16le",
        "-",
    ]
    result = run_binary_command(command, description="Decode audio for timing analysis")
    samples = array.array("h")
    samples.frombytes(result.stdout)
    if not samples:
        return None

    energies: list[float] = []
    for index in range(0, len(samples), frame_size):
        frame = samples[index:index + frame_size]
        if not frame:
            continue
        rms = math.sqrt(sum((sample / 32768.0) ** 2 for sample in frame) / len(frame))
        energies.append(rms)

    if len(energies) < 4:
        return None

    peak = max(energies) or 1.0
    normalized = [energy / peak for energy in energies]
    smoothed = moving_average(normalized, radius=2)
    active_threshold = max(0.035, percentile(smoothed, 0.20) * 1.8)
    intro_threshold = max(0.010, percentile(smoothed, 0.12) * 1.25)
    strong_threshold = max(0.18, percentile(smoothed, 0.70))
    very_strong_threshold = max(0.24, percentile(smoothed, 0.84))

    intro_silence_end = 0.0
    sustain_frames = max(2, int(1.5 / frame_seconds))
    for index in range(0, max(1, len(smoothed) - sustain_frames)):
        sustained = smoothed[index:index + sustain_frames]
        if sustained and sum(1 for energy in sustained if energy >= intro_threshold) >= max(2, sustain_frames - 1):
            intro_silence_end = index * frame_seconds
            break

    energy_change_times = detect_energy_changes(smoothed, frame_seconds)
    beat_times = detect_beat_grid(smoothed, frame_seconds)
    likely_vocal_zones = detect_zones(
        smoothed,
        frame_seconds,
        threshold=strong_threshold,
        min_duration=4.0,
        max_gap=1.5,
    )
    if not likely_vocal_zones:
        likely_vocal_zones = [(intro_silence_end, audio_duration)]
    chorus_zones = detect_zones(
        smoothed,
        frame_seconds,
        threshold=very_strong_threshold,
        min_duration=6.0,
        max_gap=2.0,
    )

    summary = (
        f"intro_silence_end={intro_silence_end:.2f}s, "
        f"beats={len(beat_times)}, changes={len(energy_change_times)}, "
        f"vocal_zones={len(likely_vocal_zones)}, chorus_zones={len(chorus_zones)}"
    )
    return AudioAnalysis(
        beat_times=beat_times,
        chorus_zones=chorus_zones[:8],
        energy_change_times=energy_change_times[:24],
        intro_silence_end=min(intro_silence_end, max(0.0, audio_duration - 1.0)),
        likely_vocal_zones=likely_vocal_zones[:10],
        summary=summary,
    )


def moving_average(values: list[float], radius: int) -> list[float]:
    averaged: list[float] = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        averaged.append(sum(values[start:end]) / (end - start))
    return averaged


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = min(len(sorted_values) - 1, max(0, int(round((len(sorted_values) - 1) * quantile))))
    return sorted_values[index]


def detect_energy_changes(energies: list[float], frame_seconds: float) -> list[float]:
    if len(energies) < 8:
        return []
    deltas = [abs(energies[index] - energies[index - 1]) for index in range(1, len(energies))]
    threshold = max(0.08, percentile(deltas, 0.88))
    changes: list[float] = []
    last_time = -999.0
    for index, delta in enumerate(deltas, start=1):
        event_time = index * frame_seconds
        if delta >= threshold and event_time - last_time >= 6.0:
            changes.append(event_time)
            last_time = event_time
    return changes


def detect_beat_grid(energies: list[float], frame_seconds: float) -> list[float]:
    if len(energies) < 8:
        return []
    threshold = max(0.10, percentile(energies, 0.72))
    beats: list[float] = []
    last_time = -999.0
    for index in range(1, len(energies) - 1):
        event_time = index * frame_seconds
        if event_time - last_time < 0.35:
            continue
        if energies[index] >= threshold and energies[index] >= energies[index - 1] and energies[index] >= energies[index + 1]:
            beats.append(event_time)
            last_time = event_time
    return beats


def detect_zones(
    energies: list[float],
    frame_seconds: float,
    *,
    threshold: float,
    min_duration: float,
    max_gap: float,
) -> list[tuple[float, float]]:
    zones: list[tuple[float, float]] = []
    active_start: float | None = None
    last_active: float | None = None

    for index, energy in enumerate(energies):
        time = index * frame_seconds
        if energy >= threshold:
            if active_start is None:
                active_start = time
            last_active = time
            continue

        if active_start is not None and last_active is not None and time - last_active > max_gap:
            zone_end = last_active + frame_seconds
            if zone_end - active_start >= min_duration:
                zones.append((active_start, zone_end))
            active_start = None
            last_active = None

    if active_start is not None and last_active is not None:
        zone_end = last_active + frame_seconds
        if zone_end - active_start >= min_duration:
            zones.append((active_start, zone_end))
    return zones


def parse_lyrics(
    lyrics_path: Path,
    audio_duration: float,
    audio_analysis: AudioAnalysis | None,
) -> LyricTimingResult:
    raw_lines = lyrics_path.read_text(encoding="utf-8-sig").splitlines()
    parsed = parse_lyric_source(raw_lines)

    if not parsed["plain_lines"]:
        raise WorkflowError("Lyrics file is empty. Add plain lyric lines or .lrc timestamped lyrics.")

    timestamped_count = len(parsed["timestamped"])
    total_lines = len(parsed["plain_lines"])
    detected_sections = parsed["detected_sections"]

    if timestamped_count and timestamped_count >= max(1, math.ceil(total_lines * 0.6)):
        return LyricTimingResult(
            audio_analysis=audio_analysis,
            detected_sections=detected_sections,
            lines=prepare_lrc_timing(parsed["timestamped"], audio_duration),
            mode="manual_lrc",
        )

    if audio_analysis is not None and detected_sections:
        return LyricTimingResult(
            audio_analysis=audio_analysis,
            detected_sections=detected_sections,
            lines=distribute_audio_assisted_section_lyrics(
                parsed["plain_lines"],
                audio_duration,
                audio_analysis,
            ),
            mode="audio_assisted_section_weighted",
        )

    if audio_analysis is not None:
        return LyricTimingResult(
            audio_analysis=audio_analysis,
            detected_sections=[],
            lines=distribute_audio_assisted_even_lyrics(
                parsed["plain_lines"],
                audio_duration,
                audio_analysis,
            ),
            mode="audio_assisted_even",
        )

    if detected_sections:
        return LyricTimingResult(
            audio_analysis=audio_analysis,
            detected_sections=detected_sections,
            lines=distribute_section_weighted_lyrics(parsed["plain_lines"], audio_duration),
            mode="section_weighted",
        )

    return LyricTimingResult(
        audio_analysis=audio_analysis,
        detected_sections=[],
        lines=distribute_even_lyrics(parsed["plain_lines"], audio_duration),
        mode="even_fallback",
    )


def parse_lyric_source(raw_lines: list[str]) -> dict[str, Any]:
    current_section = "Lyrics"
    detected_sections: list[str] = []
    plain_lines: list[tuple[str, str]] = []
    timestamped: list[tuple[float, str, str]] = []

    for raw_line in raw_lines:
        line = raw_line.strip()
        if not line:
            continue

        section_match = SECTION_HEADER_RE.fullmatch(line)
        timestamp_match = LRC_TIMESTAMP_RE.match(line)
        if section_match and not timestamp_match:
            current_section = normalize_section_name(section_match.group(1))
            if current_section not in detected_sections:
                detected_sections.append(current_section)
            continue

        if timestamp_match:
            lyric_text = line[timestamp_match.end() :].strip()
            if not lyric_text:
                continue
            start = timestamp_to_seconds(timestamp_match)
            timestamped.append((start, lyric_text, current_section))
            plain_lines.append((lyric_text, current_section))
            continue

        plain_lines.append((line, current_section))

    return {
        "detected_sections": detected_sections,
        "plain_lines": plain_lines,
        "timestamped": sorted(timestamped, key=lambda item: item[0]),
    }


def normalize_section_name(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value.strip())
    lower = cleaned.lower()
    if lower in {"prechorus", "pre chorus"}:
        return "Pre-Chorus"
    if lower == "final chorus":
        return "Final Chorus"
    return cleaned.title().replace("Pre-Chorus", "Pre-Chorus")


def timestamp_to_seconds(match: re.Match[str]) -> float:
    minutes = int(match.group(1))
    seconds = int(match.group(2))
    fraction_text = match.group(3) or "0"
    if len(fraction_text) == 3:
        fraction = int(fraction_text) / 1000
    elif len(fraction_text) == 2:
        fraction = int(fraction_text) / 100
    else:
        fraction = int(fraction_text) / 10
    return minutes * 60 + seconds + fraction


def prepare_lrc_timing(entries: list[tuple[float, str, str]], audio_duration: float) -> list[LyricLine]:
    lyrics: list[LyricLine] = []
    for index, (start, text, section) in enumerate(entries):
        if start >= audio_duration:
            continue
        next_start = entries[index + 1][0] if index + 1 < len(entries) else audio_duration
        natural_end = min(audio_duration, max(start + 0.4, next_start - 0.15))
        if natural_end - start > 5.5:
            natural_end = start + 5.5
        elif natural_end - start < 1.8 and next_start - start >= 1.8:
            natural_end = min(audio_duration, start + 1.8)
        lyrics.append(LyricLine(
            text=text,
            start=max(0.0, start),
            end=max(start + 0.4, natural_end),
            section=section,
            confidence=0.96,
        ))
    if not lyrics:
        raise WorkflowError("No usable timestamped lyric lines were found within the audio duration.")
    return lyrics


def distribute_section_weighted_lyrics(lines: list[tuple[str, str]], audio_duration: float) -> list[LyricLine]:
    blocks: list[tuple[str, list[str]]] = []
    for text, section in lines:
        if not blocks or blocks[-1][0] != section:
            blocks.append((section, []))
        blocks[-1][1].append(text)

    weighted_blocks = [(section, block_lines, section_weight(section)) for section, block_lines in blocks if block_lines]
    total_weight = sum(weight for _, _, weight in weighted_blocks) or 1.0
    cursor = 0.0
    lyrics: list[LyricLine] = []

    for index, (section, block_lines, weight) in enumerate(weighted_blocks):
        remaining_duration = max(0.1, audio_duration - cursor)
        block_duration = audio_duration * (weight / total_weight)
        if index == len(weighted_blocks) - 1:
            block_duration = remaining_duration
        else:
            block_duration = min(block_duration, remaining_duration)
        block_end = min(audio_duration, cursor + block_duration)
        lyrics.extend(distribute_lines_in_window(block_lines, cursor, block_end, section))
        cursor = block_end

    return lyrics


def distribute_audio_assisted_section_lyrics(
    lines: list[tuple[str, str]],
    audio_duration: float,
    audio_analysis: AudioAnalysis,
) -> list[LyricLine]:
    blocks: list[tuple[str, list[str]]] = []
    for text, section in lines:
        if not blocks or blocks[-1][0] != section:
            blocks.append((section, []))
        blocks[-1][1].append(text)

    weighted_blocks = [(section, block_lines, section_weight(section)) for section, block_lines in blocks if block_lines]
    total_weight = sum(weight for _, _, weight in weighted_blocks) or 1.0
    active_start = choose_active_start(audio_analysis, audio_duration)
    cursor = active_start
    lyrics: list[LyricLine] = []

    for index, (section, block_lines, weight) in enumerate(weighted_blocks):
        remaining_duration = max(0.1, audio_duration - cursor)
        block_duration = max(0.1, (audio_duration - active_start) * (weight / total_weight))
        if index == len(weighted_blocks) - 1:
            natural_end = audio_duration
        else:
            natural_end = min(audio_duration, cursor + block_duration)
        boundary = choose_audio_boundary(
            natural_end,
            audio_analysis,
            min_time=cursor + max(1.5, len(block_lines) * 0.8),
            max_time=audio_duration,
        )
        block_end = min(audio_duration, max(cursor + 0.35, min(boundary, cursor + remaining_duration)))
        lyrics.extend(distribute_lines_in_window(
            block_lines,
            cursor,
            block_end,
            section,
            audio_analysis=audio_analysis,
        ))
        cursor = block_end

    return lyrics


def distribute_audio_assisted_even_lyrics(
    lines: list[tuple[str, str]],
    audio_duration: float,
    audio_analysis: AudioAnalysis,
) -> list[LyricLine]:
    active_start = choose_active_start(audio_analysis, audio_duration)
    active_end = choose_active_end(audio_analysis, audio_duration)
    if active_end - active_start < max(8.0, len(lines) * 1.2):
        active_start = 0.0
        active_end = audio_duration
    return distribute_lines_in_window(
        [text for text, _ in lines],
        active_start,
        active_end,
        "Lyrics",
        audio_analysis=audio_analysis,
    )


def choose_active_start(audio_analysis: AudioAnalysis, audio_duration: float) -> float:
    candidates = [audio_analysis.intro_silence_end]
    if audio_analysis.likely_vocal_zones:
        candidates.append(audio_analysis.likely_vocal_zones[0][0])
    start = max(0.0, min(candidates))
    if start > audio_duration * 0.25:
        return 0.0
    if start < 0.5:
        return 0.0
    return snap_to_grid(start, audio_analysis, max_shift=1.0)


def choose_active_end(audio_analysis: AudioAnalysis, audio_duration: float) -> float:
    if audio_analysis.likely_vocal_zones:
        end = audio_analysis.likely_vocal_zones[-1][1]
        if end >= audio_duration * 0.55:
            return min(audio_duration, max(end, audio_duration - 1.0))
    return audio_duration


def choose_audio_boundary(
    target: float,
    audio_analysis: AudioAnalysis,
    *,
    min_time: float,
    max_time: float,
) -> float:
    candidates = [
        event_time
        for event_time in audio_analysis.energy_change_times
        if min_time <= event_time <= max_time and abs(event_time - target) <= 10.0
    ]
    for zone_start, zone_end in audio_analysis.chorus_zones:
        for event_time in (zone_start, zone_end):
            if min_time <= event_time <= max_time and abs(event_time - target) <= 10.0:
                candidates.append(event_time)
    if not candidates:
        return snap_to_grid(target, audio_analysis, max_shift=1.0)
    return snap_to_grid(min(candidates, key=lambda event_time: abs(event_time - target)), audio_analysis, max_shift=0.75)


def snap_to_grid(time_value: float, audio_analysis: AudioAnalysis | None, max_shift: float = 0.75) -> float:
    if audio_analysis is None or not audio_analysis.beat_times:
        return time_value
    nearest = min(audio_analysis.beat_times, key=lambda beat_time: abs(beat_time - time_value))
    return nearest if abs(nearest - time_value) <= max_shift else time_value


def line_confidence(start: float, end: float, section: str, audio_analysis: AudioAnalysis | None) -> float:
    if audio_analysis is None:
        return 0.58 if section != "Lyrics" else 0.45
    confidence = 0.58
    if in_any_zone(start, audio_analysis.likely_vocal_zones) or in_any_zone((start + end) / 2, audio_analysis.likely_vocal_zones):
        confidence += 0.18
    if section != "Lyrics":
        confidence += 0.06
    if audio_analysis.beat_times:
        nearest = min(abs(beat_time - start) for beat_time in audio_analysis.beat_times)
        if nearest <= 0.4:
            confidence += 0.08
    if in_any_zone(start, audio_analysis.chorus_zones) and "chorus" in section.lower():
        confidence += 0.08
    return min(0.92, max(0.35, confidence))


def in_any_zone(time_value: float, zones: list[tuple[float, float]]) -> bool:
    return any(start <= time_value <= end for start, end in zones)


def section_weight(section: str) -> float:
    lower = section.lower()
    if "final" in lower and "chorus" in lower:
        return SECTION_WEIGHTS["final chorus"]
    if "pre" in lower and "chorus" in lower:
        return SECTION_WEIGHTS["pre-chorus"]
    if "verse 2" in lower or "verse ii" in lower:
        return SECTION_WEIGHTS["verse 2"]
    if "intro" in lower:
        return SECTION_WEIGHTS["intro"]
    if "verse" in lower:
        return SECTION_WEIGHTS["verse"]
    if "chorus" in lower:
        return SECTION_WEIGHTS["chorus"]
    if "outro" in lower:
        return SECTION_WEIGHTS["outro"]
    return 0.12


def distribute_even_lyrics(lines: list[tuple[str, str]], audio_duration: float) -> list[LyricLine]:
    return distribute_lines_in_window([text for text, _ in lines], 0.0, audio_duration, "Lyrics")


def distribute_lines_in_window(
    lines: list[str],
    start: float,
    end: float,
    section: str,
    *,
    audio_analysis: AudioAnalysis | None = None,
) -> list[LyricLine]:
    if not lines:
        return []

    window_duration = max(0.1, end - start)
    slot = window_duration / len(lines)
    gap = min(0.28, max(0.08, slot * 0.08))
    lyrics: list[LyricLine] = []

    for index, text in enumerate(lines):
        line_start = snap_to_grid(start + index * slot, audio_analysis, max_shift=min(0.65, slot * 0.25))
        next_start = end if index == len(lines) - 1 else start + (index + 1) * slot
        available = max(0.35, next_start - line_start - gap)
        if slot >= 2.0:
            line_duration = min(5.5, max(1.8, available))
        else:
            line_duration = available
        line_end = min(end, line_start + line_duration)
        if line_end <= line_start:
            line_end = min(end, line_start + 0.35)
        lyrics.append(LyricLine(
            text=text,
            start=line_start,
            end=line_end,
            section=section,
            confidence=line_confidence(line_start, line_end, section, audio_analysis),
        ))

    return lyrics


def prepare_scene_timing(config: dict[str, Any], audio_duration: float) -> list[SceneSegment]:
    strategy = str(config.get("scene_duration_strategy", "even")).strip().lower()
    if strategy != "even":
        raise WorkflowError("This MVP workflow currently supports scene_duration_strategy 'even' only.")

    scene_count = positive_int(config.get("scene_count"), "scene_count")
    scene_defs = config.get("scenes", [])
    if not isinstance(scene_defs, list) or not scene_defs:
        scene_defs = default_scene_defs()

    discovered_clips = discover_video_clips()
    visual_source = str(config.get("visual_source", "auto")).strip().lower()
    if visual_source not in {"auto", "image", "placeholder", "start_image", "video_clips"}:
        raise WorkflowError(
            "Config field 'visual_source' must be one of: auto, video_clips, image, start_image, placeholder."
        )
    if visual_source == "video_clips" and not discovered_clips and not has_scene_clip(scene_defs):
        raise WorkflowError("visual_source is 'video_clips', but no clips were found in input/video_clips and no scene source_clip is configured.")

    start_image = optional_string(config.get("start_image", ""))
    default_image_path = repo_path(start_image) if start_image else None
    segment_duration = audio_duration / scene_count

    scenes: list[SceneSegment] = []
    for index in range(scene_count):
        scene_def = scene_defs[index % len(scene_defs)]
        if not isinstance(scene_def, dict):
            raise WorkflowError(f"Scene {index + 1} must be an object.")

        start = index * segment_duration
        end = audio_duration if index == scene_count - 1 else (index + 1) * segment_duration
        source_kind, source_path = choose_scene_source(
            scene_def=scene_def,
            scene_index=index,
            visual_source=visual_source,
            discovered_clips=discovered_clips,
            default_image_path=default_image_path,
        )

        scenes.append(
            SceneSegment(
                index=index + 1,
                name=str(scene_def.get("name") or f"Scene {index + 1}"),
                start=start,
                end=end,
                color=str(scene_def.get("color") or default_scene_defs()[index % len(default_scene_defs())]["color"]),
                accent_color=str(scene_def.get("accent_color") or "#FFFFFF"),
                source_kind=source_kind,
                source_path=source_path,
            )
        )
    return scenes


def default_scene_defs() -> list[dict[str, str]]:
    return [
        {"name": "Opening pulse", "color": "#101820", "accent_color": "#5EEAD4"},
        {"name": "Verse drift", "color": "#1D2B53", "accent_color": "#F4D35E"},
        {"name": "Chorus lift", "color": "#2F184B", "accent_color": "#F15BB5"},
        {"name": "Final glow", "color": "#0B3D2E", "accent_color": "#FF9F1C"},
    ]


def discover_video_clips() -> list[Path]:
    video_dir = ROOT / "input" / "video_clips"
    if not video_dir.exists():
        return []
    return sorted(
        path
        for path in video_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_VIDEO_EXTENSIONS
    )


def has_scene_clip(scene_defs: list[Any]) -> bool:
    return any(isinstance(scene, dict) and str(scene.get("source_clip", "")).strip() for scene in scene_defs)


def choose_scene_source(
    scene_def: dict[str, Any],
    scene_index: int,
    visual_source: str,
    discovered_clips: list[Path],
    default_image_path: Path | None,
) -> tuple[str, Path | None]:
    source_clip = optional_string(scene_def.get("source_clip", ""))
    if source_clip:
        return "clip", repo_path(source_clip)

    source_image = optional_string(scene_def.get("source_image", ""))
    if source_image:
        return "image", repo_path(source_image)

    if default_image_path is not None and visual_source in {"auto", "image", "start_image"}:
        return "image", default_image_path

    if visual_source in {"auto", "video_clips"} and discovered_clips:
        return "clip", discovered_clips[scene_index % len(discovered_clips)]

    return "placeholder", None


def render_scene_clips(
    config: dict[str, Any],
    scenes: list[SceneSegment],
    temp_dir: Path,
    width: int,
    height: int,
    fps: int,
) -> list[Path]:
    scene_paths: list[Path] = []
    for scene in scenes:
        output_path = temp_dir / f"scene_{scene.index:03}.mp4"
        if scene.source_kind == "clip" and scene.source_path is not None:
            render_clip_scene(scene.source_path, output_path, scene.duration, width, height, fps, config)
        elif scene.source_kind == "image" and scene.source_path is not None:
            render_image_scene(scene.source_path, output_path, scene.duration, width, height, fps, config)
        else:
            render_placeholder_scene(scene, output_path, width, height, fps, config)
        scene_paths.append(output_path)
    return scene_paths


def render_clip_scene(
    source_path: Path,
    output_path: Path,
    duration: float,
    width: int,
    height: int,
    fps: int,
    config: dict[str, Any],
) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        str(source_path),
        "-t",
        f"{duration:.3f}",
        "-vf",
        f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={fps},setsar=1,format=yuv420p",
        "-an",
        "-c:v",
        str(config.get("render_settings", {}).get("video_codec", "libx264")),
        "-preset",
        str(config.get("render_settings", {}).get("preset", "medium")),
        "-crf",
        str(config.get("render_settings", {}).get("crf", 20)),
        str(output_path),
    ]
    run_command(command, description=f"Render clip scene from {display_path(source_path)}")


def render_image_scene(
    source_path: Path,
    output_path: Path,
    duration: float,
    width: int,
    height: int,
    fps: int,
    config: dict[str, Any],
) -> None:
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        f"zoompan=z='min(zoom+0.0008,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d=1:s={width}x{height}:fps={fps},format=yuv420p"
    )
    command = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(source_path),
        "-t",
        f"{duration:.3f}",
        "-vf",
        video_filter,
        "-an",
        "-c:v",
        str(config.get("render_settings", {}).get("video_codec", "libx264")),
        "-preset",
        str(config.get("render_settings", {}).get("preset", "medium")),
        "-crf",
        str(config.get("render_settings", {}).get("crf", 20)),
        str(output_path),
    ]
    run_command(command, description=f"Render image scene from {display_path(source_path)}")


def render_placeholder_scene(
    scene: SceneSegment,
    output_path: Path,
    width: int,
    height: int,
    fps: int,
    config: dict[str, Any],
) -> None:
    base_color = ffmpeg_color(scene.color)
    accent_color = ffmpeg_color(scene.accent_color)
    lavfi_input = (
        f"gradients=s={width}x{height}:r={fps}:d={scene.duration:.3f}:"
        f"c0={base_color}:c1={accent_color}:c2=0x202020:n=3:speed=0.02:type=linear"
    )
    video_filter = (
        "format=rgba,"
        f"drawbox=x='iw*0.08':y='ih*0.13':w='iw*0.84':h='ih*0.18':"
        f"color={accent_color}@0.12:t=fill,"
        f"drawbox=x='iw*0.14':y='ih*0.38':w='iw*0.72':h='ih*0.20':"
        "color=white@0.055:t=fill,"
        f"drawbox=x='iw*0.22':y='ih*0.66':w='iw*0.56':h='ih*0.10':"
        f"color={accent_color}@0.10:t=fill,"
        "format=yuv420p"
    )
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        lavfi_input,
        "-t",
        f"{scene.duration:.3f}",
        "-vf",
        video_filter,
        "-an",
        "-c:v",
        str(config.get("render_settings", {}).get("video_codec", "libx264")),
        "-preset",
        str(config.get("render_settings", {}).get("preset", "medium")),
        "-crf",
        str(config.get("render_settings", {}).get("crf", 20)),
        str(output_path),
    ]
    run_command(command, description=f"Render placeholder scene {scene.index}")


def ffmpeg_color(value: str) -> str:
    color = value.strip()
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
        return "0x" + color[1:]
    if re.fullmatch(r"0x[0-9A-Fa-f]{6}", color):
        return color
    raise WorkflowError(f"Color values must be hex strings like '#101820'. Got: {value!r}")


def concatenate_scene_clips(scene_paths: list[Path], output_path: Path, temp_dir: Path) -> None:
    concat_file = temp_dir / "scene_concat.txt"
    concat_lines = [f"file '{path.name}'" for path in scene_paths]
    concat_file.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_file.name,
        "-c",
        "copy",
        output_path.name,
    ]
    run_command(command, cwd=temp_dir, description="Concatenate scene clips")


def write_timing_preview(project_name: str, lyrics: list[LyricLine]) -> Path:
    preview_path = ROOT / "output" / "temp" / f"{project_name}_lyric_timing_preview.json"
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview = [
        {
            "start": round(lyric.start, 3),
            "end": round(lyric.end, 3),
            "text": lyric.text,
            "section": lyric.section,
            "confidence": round(lyric.confidence, 3),
        }
        for lyric in lyrics
    ]
    preview_path.write_text(json.dumps(preview, indent=2), encoding="utf-8")
    return preview_path


def write_ass_subtitles(
    ass_path: Path,
    lyrics: list[LyricLine],
    width: int,
    height: int,
    font_settings: dict[str, Any],
) -> Path:
    font_family = str(font_settings.get("family", "Arial"))
    font_size = positive_int(font_settings.get("size", 58), "font.size")
    margin_v = positive_int(font_settings.get("margin_v", 96), "font.margin_v")
    outline_width = positive_int(font_settings.get("outline_width", 3), "font.outline_width")
    shadow = non_negative_int(font_settings.get("shadow", 1), "font.shadow")
    max_chars = positive_int(font_settings.get("max_chars_per_line", 42), "font.max_chars_per_line")
    primary_color = ass_color(str(font_settings.get("color", "#FFFFFF")))
    outline_color = ass_color(str(font_settings.get("outline_color", "#000000")), alpha="60")

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "",
        "[V4+ Styles]",
        (
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
        ),
        (
            f"Style: Default,{font_family},{font_size},{primary_color},&H000000FF,{outline_color},&H90000000,"
            f"0,0,0,0,100,100,0,0,1,{outline_width},{shadow},2,120,120,{margin_v},1"
        ),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    for lyric in lyrics:
        subtitle_text = wrap_ass_text(lyric.text, max_chars)
        lines.append(
            f"Dialogue: 0,{ass_time(lyric.start)},{ass_time(lyric.end)},Default,,0,0,0,,{subtitle_text}"
        )

    ass_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return ass_path


def ass_color(hex_color: str, alpha: str = "00") -> str:
    color = hex_color.strip()
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
        raise WorkflowError(f"Subtitle colors must be hex strings like '#FFFFFF'. Got: {hex_color!r}")
    red = color[1:3]
    green = color[3:5]
    blue = color[5:7]
    return f"&H{alpha}{blue}{green}{red}"


def wrap_ass_text(text: str, max_chars: int) -> str:
    escaped = text.replace("{", "(").replace("}", ")").replace("\\", "\\\\")
    wrapped = textwrap.wrap(escaped, width=max_chars, break_long_words=False, break_on_hyphens=False)
    if not wrapped:
        return escaped
    return r"\N".join(wrapped)


def ass_time(seconds: float) -> str:
    centiseconds_total = int(round(max(0.0, seconds) * 100))
    hours = centiseconds_total // 360000
    remaining = centiseconds_total % 360000
    minutes = remaining // 6000
    remaining %= 6000
    whole_seconds = remaining // 100
    centiseconds = remaining % 100
    return f"{hours}:{minutes:02}:{whole_seconds:02}.{centiseconds:02}"


def render_final_video(
    config: dict[str, Any],
    visuals_path: Path,
    audio_path: Path,
    subtitle_path: Path | None,
    output_path: Path,
) -> None:
    render_settings = config.get("render_settings", {})
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(visuals_path),
        "-i",
        str(audio_path),
    ]

    if subtitle_path is not None:
        subtitle_filter_path = display_path(subtitle_path).replace("\\", "/")
        command.extend(["-vf", f"subtitles={subtitle_filter_path}"])

    command.extend(
        [
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            str(render_settings.get("video_codec", "libx264")),
            "-preset",
            str(render_settings.get("preset", "medium")),
            "-crf",
            str(render_settings.get("crf", 20)),
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            str(render_settings.get("audio_codec", "aac")),
            "-b:a",
            str(render_settings.get("audio_bitrate", "192k")),
            "-shortest",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    run_command(command, description="Render final lyric video")


def run_command(
    command: list[str],
    *,
    description: str,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=str(cwd or ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.strip().splitlines()[-12:])
        raise WorkflowError(f"{description} failed with exit code {result.returncode}.\n{stderr_tail}")
    return result


def run_binary_command(
    command: list[str],
    *,
    description: str,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        command,
        cwd=str(cwd or ROOT),
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.decode("utf-8", errors="replace").strip().splitlines()[-12:])
        raise WorkflowError(f"{description} failed with exit code {result.returncode}.\n{stderr_tail}")
    return result


def build_render_log(
    *,
    status: str,
    config_path: Path,
    config: dict[str, Any],
    audio_path: Path | None,
    lyrics_path: Path | None,
    audio_duration: float | None,
    lyric_timing: LyricTimingResult,
    scenes: list[SceneSegment],
    output_path: Path | None,
    timing_preview_path: Path | None,
    error_message: str | None,
) -> list[str]:
    lines = [
        "Creation Station lyric video test render log",
        f"Status: {status}",
        f"Rendered at: {datetime.now().isoformat(timespec='seconds')}",
        f"Config: {display_path(config_path)}",
        f"Project: {config.get('project_name', '')}",
        f"Visual style: {config.get('visual_style', '')}",
    ]
    if audio_path is not None:
        lines.append(f"Audio file: {display_path(audio_path)}")
    if lyrics_path is not None:
        lines.append(f"Lyrics file: {display_path(lyrics_path)}")
    if audio_duration is not None:
        lines.append(f"Audio duration: {audio_duration:.3f}s")
    if output_path is not None:
        lines.append(f"Output file: {display_path(output_path)}")
    if timing_preview_path is not None:
        lines.append(f"Timing preview: {display_path(timing_preview_path)}")
    if error_message:
        lines.extend(["", "Error:", error_message])

    lyrics = lyric_timing.lines
    lines.extend([
        "",
        f"Lyric lines: {len(lyrics)}",
        f"Timing mode: {lyric_timing.mode}",
        f"Detected sections: {', '.join(lyric_timing.detected_sections) if lyric_timing.detected_sections else 'none'}",
        f"Audio analysis: {lyric_timing.audio_analysis.summary if lyric_timing.audio_analysis else 'disabled or unavailable'}",
        "",
        "First timed lyric lines:",
    ])
    for index, lyric in enumerate(lyrics[:5], start=1):
        lines.append(
            f"{index:02}. {lyric.start:.2f}s -> {lyric.end:.2f}s | "
            f"{lyric.section} | confidence={lyric.confidence:.2f} | {lyric.text}"
        )

    lines.append("")
    lines.append("Last timed lyric lines:")
    last_start_index = max(0, len(lyrics) - 5)
    for index, lyric in enumerate(lyrics[last_start_index:], start=last_start_index + 1):
        lines.append(
            f"{index:02}. {lyric.start:.2f}s -> {lyric.end:.2f}s | "
            f"{lyric.section} | confidence={lyric.confidence:.2f} | {lyric.text}"
        )

    lines.extend(["", f"Scenes: {len(scenes)}"])
    for scene in scenes:
        source = scene.source_kind
        if scene.source_path is not None:
            source = f"{source}: {display_path(scene.source_path)}"
        lines.append(f"{scene.index:02}. {scene.start:.2f}s -> {scene.end:.2f}s | {scene.name} | {source}")
    return lines


def write_failure_log(config_path: Path, config: dict[str, Any], error_message: str) -> None:
    try:
        project_name = get_project_name(config)
    except WorkflowError:
        project_name = "lyric_video_test"
    output_paths = build_output_paths(project_name, config)
    output_paths["log_path"].parent.mkdir(parents=True, exist_ok=True)
    log_lines = build_render_log(
        status="FAILED",
        config_path=config_path,
        config=config,
        audio_path=repo_path(str(config.get("audio_file", ""))) if config.get("audio_file") else None,
        lyrics_path=repo_path(str(config.get("lyrics_file", ""))) if config.get("lyrics_file") else None,
        audio_duration=None,
        lyric_timing=LyricTimingResult(audio_analysis=None, detected_sections=[], lines=[], mode="unknown"),
        scenes=[],
        output_path=output_paths["render_path"],
        timing_preview_path=None,
        error_message=error_message,
    )
    output_paths["log_path"].write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    print(f"Failure log: {display_path(output_paths['log_path'])}")


if __name__ == "__main__":
    raise SystemExit(main())
