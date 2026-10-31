"""AI watermark removal (delogo / blur / crop-mosaic)."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict

from app.tools.common import (
    ProgressFn,
    media_dir,
    probe_dimensions,
    report,
    resolve_media,
    run_ffmpeg,
)


def _region_pixels(region: Dict[str, Any], width: int, height: int) -> tuple[int, int, int, int]:
    """Convert a percentage region (0-100) into pixel coordinates."""
    rx = float(region.get("x", 0))
    ry = float(region.get("y", 0))
    rw = float(region.get("width", 0))
    rh = float(region.get("height", 0))

    x = max(0, min(width - 2, int(round(width * rx / 100))))
    y = max(0, min(height - 2, int(round(height * ry / 100))))
    w = max(2, min(width - x - 1, int(round(width * rw / 100))))
    h = max(2, min(height - y - 1, int(round(height * rh / 100))))
    return x, y, w, h


def remove_watermark(input_ref: str, region: Dict[str, Any], method: str = "delogo", progress: ProgressFn = None) -> str:
    """Return the path of a cleaned-up video."""
    source = resolve_media(input_ref)
    width, height = probe_dimensions(source)
    x, y, w, h = _region_pixels(region, width, height)

    report(progress, 25, "running")
    output = str(media_dir() / f"{uuid.uuid4()}-clean.mp4")

    # delogo needs a margin around the box; fall back to a blurred patch when
    # the filter refuses (very small regions, odd dimensions, ...).
    delogo = f"delogo=x={x}:y={y}:w={w}:h={h}:show=0"
    attempts: list[list[str]] = []

    if method in {"delogo", "auto"}:
        attempts.append(["-i", source, "-vf", delogo, "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "copy", output])

    blur = (
        f"[0:v]crop={w}:{h}:{x}:{y},boxblur=12:2[patch];"
        f"[0:v][patch]overlay={x}:{y}"
    )
    if method in {"blur", "auto"}:
        attempts.append(["-i", source, "-filter_complex", blur, "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "copy", output])

    if method in {"mosaic", "auto"}:
        mosaic = (
            f"[0:v]crop={w}:{h}:{x}:{y},scale=iw/8:ih/8:flags=neighbor,"
            f"scale={w}:{h}:flags=neighbor[patch];[0:v][patch]overlay={x}:{y}"
        )
        attempts.append(["-i", source, "-filter_complex", mosaic, "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "copy", output])

    last_error = ""
    for args in attempts:
        result = run_ffmpeg(args)
        target = Path(output)
        if result.returncode == 0 and target.exists() and target.stat().st_size > 0:
            report(progress, 45, "post_processing")
            return output
        last_error = (result.stderr or "").strip().splitlines()[-1:] and result.stderr.strip().splitlines()[-1] or "unknown ffmpeg error"

    raise ValueError(f"Watermark removal failed: {last_error}")
