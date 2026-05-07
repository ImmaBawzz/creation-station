from __future__ import annotations

import argparse
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
SAFE_PROJECT_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")


class WorkflowError(RuntimeError):
    pass


@dataclass(frozen=True)
class LyricLine:
    text: str
    start: float
    end: float


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
    args = parser.parse_args()

    ensure_folder_structure()

    config_path = resolve_path(args.config)
    config: dict[str, Any] | None = None
    log_lines: list[str] = []

    try:
        config = load_config(config_path)
        project_name = get_project_name(config)
        output_paths = build_output_paths(project_name)

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
        lyrics = parse_lyrics(lyrics_path, audio_duration)
        scenes = prepare_scene_timing(config, audio_duration)

        temp_dir = output_paths["temp_dir"]
        temp_dir.mkdir(parents=True, exist_ok=True)

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
            lyrics=lyrics,
            scenes=scenes,
            output_path=output_paths["render_path"],
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


def build_output_paths(project_name: str) -> dict[str, Path]:
    render_path = ROOT / "output" / "renders" / f"{project_name}_lyric_video_test.mp4"
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


def parse_lyrics(lyrics_path: Path, audio_duration: float) -> list[LyricLine]:
    raw_lines = lyrics_path.read_text(encoding="utf-8-sig").splitlines()
    lrc_entries = parse_lrc_entries(raw_lines)
    if lrc_entries:
        return prepare_lrc_timing(lrc_entries, audio_duration)
    return distribute_plain_lyrics(raw_lines, audio_duration)


def parse_lrc_entries(raw_lines: list[str]) -> list[tuple[float, str]]:
    entries: list[tuple[float, str]] = []
    for raw_line in raw_lines:
        matches = list(LRC_TIMESTAMP_RE.finditer(raw_line))
        if not matches:
            continue
        lyric_text = raw_line[matches[-1].end() :].strip()
        if not lyric_text:
            continue
        for match in matches:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            fraction_text = match.group(3) or "0"
            if len(fraction_text) == 3:
                fraction = int(fraction_text) / 1000
            elif len(fraction_text) == 2:
                fraction = int(fraction_text) / 100
            else:
                fraction = int(fraction_text) / 10
            entries.append((minutes * 60 + seconds + fraction, lyric_text))
    return sorted(entries, key=lambda item: item[0])


def prepare_lrc_timing(entries: list[tuple[float, str]], audio_duration: float) -> list[LyricLine]:
    lyrics: list[LyricLine] = []
    for index, (start, text) in enumerate(entries):
        if start >= audio_duration:
            continue
        next_start = entries[index + 1][0] if index + 1 < len(entries) else audio_duration
        end = min(audio_duration, max(start + 0.1, next_start))
        lyrics.append(LyricLine(text=text, start=max(0.0, start), end=end))
    if not lyrics:
        raise WorkflowError("No usable timestamped lyric lines were found within the audio duration.")
    return lyrics


def distribute_plain_lyrics(raw_lines: list[str], audio_duration: float) -> list[LyricLine]:
    lines = [line.strip() for line in raw_lines if line.strip()]
    if not lines:
        raise WorkflowError("Lyrics file is empty. Add plain lyric lines or .lrc timestamped lyrics.")

    slot = audio_duration / len(lines)
    lyrics: list[LyricLine] = []
    for index, line in enumerate(lines):
        start = index * slot
        end = audio_duration if index == len(lines) - 1 else (index + 1) * slot
        lyrics.append(LyricLine(text=line, start=start, end=max(start + 0.1, end)))
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


def build_render_log(
    *,
    status: str,
    config_path: Path,
    config: dict[str, Any],
    audio_path: Path | None,
    lyrics_path: Path | None,
    audio_duration: float | None,
    lyrics: list[LyricLine],
    scenes: list[SceneSegment],
    output_path: Path | None,
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
    if error_message:
        lines.extend(["", "Error:", error_message])

    lines.extend(["", f"Lyric lines: {len(lyrics)}"])
    for index, lyric in enumerate(lyrics[:10], start=1):
        lines.append(f"{index:02}. {lyric.start:.2f}s -> {lyric.end:.2f}s | {lyric.text}")
    if len(lyrics) > 10:
        lines.append(f"... {len(lyrics) - 10} more lyric lines")

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
    output_paths = build_output_paths(project_name)
    output_paths["log_path"].parent.mkdir(parents=True, exist_ok=True)
    log_lines = build_render_log(
        status="FAILED",
        config_path=config_path,
        config=config,
        audio_path=repo_path(str(config.get("audio_file", ""))) if config.get("audio_file") else None,
        lyrics_path=repo_path(str(config.get("lyrics_file", ""))) if config.get("lyrics_file") else None,
        audio_duration=None,
        lyrics=[],
        scenes=[],
        output_path=output_paths["render_path"],
        error_message=error_message,
    )
    output_paths["log_path"].write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    print(f"Failure log: {display_path(output_paths['log_path'])}")


if __name__ == "__main__":
    raise SystemExit(main())
