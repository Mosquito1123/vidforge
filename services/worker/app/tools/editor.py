"""AI video editing: trim, merge, background music and text overlay."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from app.tools.common import (
    ProgressFn,
    media_dir,
    probe_dimensions,
    report,
    resolve_media,
    run_ffmpeg,
)


def _normalize(source: str, output: str, width: int, height: int, fps: int) -> bool:
    """Re-encode a clip to a uniform format so clips can be concatenated."""
    result = run_ffmpeg(
        [
            "-i", source,
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                   f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-r", str(fps),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            output,
        ]
    )
    return result.returncode == 0 and Path(output).exists() and Path(output).stat().st_size > 0


def edit_video(
    clips: List[str],
    *,
    trim_start: float = 0.0,
    trim_end: Optional[float] = None,
    bgm: Optional[str] = None,
    bgm_volume: float = 0.25,
    caption: Optional[str] = None,
    progress: ProgressFn = None,
) -> tuple[str, dict]:
    if not clips:
        raise ValueError("At least one clip is required")

    work = media_dir() / "edit" / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=True)

    sources = [resolve_media(clip) for clip in clips]
    base_width, base_height = probe_dimensions(sources[0])
    width = base_width - (base_width % 2)
    height = base_height - (base_height % 2)

    normalized: List[str] = []
    for index, source in enumerate(sources):
        report(progress, 20 + index * 5, "running")
        target = str(work / f"clip-{index}.mp4")
        if not _normalize(source, target, width, height, 24):
            raise ValueError(f"Failed to process clip {index + 1}")
        normalized.append(target)

    report(progress, 45, "running")
    merged = str(work / "merged.mp4")
    list_file = work / "clips.txt"
    list_file.write_text("".join(f"file '{Path(item).as_posix()}'\n" for item in normalized), encoding="utf-8")
    result = run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", merged])
    if result.returncode != 0 or not Path(merged).exists():
        raise ValueError("Failed to merge clips")

    current = merged

    # Trim (re-encode so the cut is frame accurate).
    if trim_start > 0 or trim_end is not None:
        trimmed = str(work / "trimmed.mp4")
        args = ["-ss", str(max(trim_start, 0)), "-i", current]
        if trim_end is not None:
            duration = max(0.5, float(trim_end) - float(trim_start))
            args += ["-t", str(duration)]
        args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", trimmed]
        if run_ffmpeg(args).returncode == 0 and Path(trimmed).exists():
            current = trimmed

    # Background music mixed under the original audio.
    if bgm:
        report(progress, 60, "post_processing")
        mixed = str(work / "mixed.mp4")
        bgm_path = resolve_media(bgm)
        filter_complex = (
            f"[1:a]volume={max(0.0, min(1.0, bgm_volume))},aloop=loop=-1:size=2e9[bg];"
            f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        )
        args = [
            "-i", current, "-i", bgm_path,
            "-filter_complex", filter_complex,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-shortest", mixed,
        ]
        if run_ffmpeg(args).returncode == 0 and Path(mixed).exists():
            current = mixed

    caption_applied = False
    # Burned-in caption (bottom third). Requires an ffmpeg build with libfreetype.
    if caption:
        report(progress, 70, "post_processing")
        captioned = str(work / "captioned.mp4")
        safe = caption.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")
        drawtext = (
            f"drawtext=text='{safe}':fontcolor=white:fontsize={max(20, height // 22)}:"
            f"box=1:boxcolor=black@0.45:boxborderw=14:x=(w-text_w)/2:y=h-text_h-{max(24, height // 14)}"
        )
        args = ["-i", current, "-vf", drawtext, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", captioned]
        if run_ffmpeg(args).returncode == 0 and Path(captioned).exists() and Path(captioned).stat().st_size > 0:
            current = captioned
            caption_applied = True

    return current, {
        "clips": len(sources),
        "trimStart": trim_start,
        "trimEnd": trim_end,
        "bgm": bool(bgm),
        "caption": bool(caption),
        "captionApplied": caption_applied,
    }
