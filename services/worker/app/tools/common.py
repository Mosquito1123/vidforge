"""Shared helpers for the media tools (edit / watermark removal / voiceover)."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from app.config import get_settings
from app.postprocess.ffmpeg import FFmpegProcessor
from app.storage import build_storage

logger = logging.getLogger(__name__)

ProgressFn = Optional[Callable[[int, str], None]]


def report(progress: ProgressFn, value: int, stage: str) -> None:
    if progress is None:
        return
    try:
        progress(value, stage)
    except Exception:  # noqa: BLE001
        pass


def media_dir() -> Path:
    path = Path(get_settings().media_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_media(value: str) -> str:
    """Turn a URL or local path into a readable local file path.

    Supports ``file://`` URLs produced by the local storage stub, ``http(s)``
    URLs from the upload endpoint or object storage, and plain file paths.
    """
    if not value:
        raise ValueError("Empty media reference")

    if value.startswith("file://"):
        path = value[len("file://") :]
        if not Path(path).exists():
            raise ValueError(f"Local media not found: {path}")
        return path

    if value.startswith("http://") or value.startswith("https://"):
        suffix = Path(value.split("?")[0]).suffix or ".bin"
        target = media_dir() / "_inputs" / f"{uuid.uuid4()}{suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(value, timeout=120) as response, open(target, "wb") as handle:
            shutil.copyfileobj(response, handle)
        return str(target)

    if Path(value).exists():
        return value

    raise ValueError(f"Unsupported media reference: {value}")


def probe_dimensions(path: str) -> tuple[int, int]:
    settings = get_settings()
    try:
        result = subprocess.run(
            [
                settings.ffprobe_binary,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "csv=p=0:s=x",
                path,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        width, height = result.stdout.strip().split("x")
        return int(width), int(height)
    except Exception:  # noqa: BLE001
        return 1280, 720


def probe_duration(path: str) -> float:
    settings = get_settings()
    try:
        result = subprocess.run(
            [
                settings.ffprobe_binary,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return float(result.stdout.strip())
    except Exception:  # noqa: BLE001
        return 0.0


def run_ffmpeg(args: list[str]) -> subprocess.CompletedProcess:
    settings = get_settings()
    return subprocess.run(
        [settings.ffmpeg_binary, "-y", *args],
        capture_output=True,
        text=True,
        check=False,
    )


def finalize_video(
    task_id: str,
    source_path: str,
    *,
    metadata: Optional[Dict[str, Any]] = None,
    progress: ProgressFn = None,
) -> Dict[str, Any]:
    """Transcode, thumbnail, HLS-ify and upload a produced video."""
    settings = get_settings()
    ffmpeg = FFmpegProcessor()
    storage = build_storage()

    work_dir = media_dir() / task_id
    work_dir.mkdir(parents=True, exist_ok=True)

    report(progress, 50, "post_processing")
    final_path = work_dir / "final.mp4"
    ffmpeg.transcode(source_path, str(final_path))
    if not final_path.exists() or final_path.stat().st_size == 0:
        raise ValueError("Post-processing produced no output; ffmpeg transcode failed")

    thumb_path = work_dir / "thumb.jpg"
    ffmpeg.generate_thumbnail(str(final_path), str(thumb_path))

    report(progress, 80, "post_processing")
    hls_dir = work_dir / "hls"
    ffmpeg.generate_hls(str(final_path), str(hls_dir), segment_duration=settings.hls_segment_duration)
    playlist = hls_dir / "index.m3u8"

    video_upload = storage.upload_file(str(final_path), f"videos/{task_id}/final.mp4", content_type="video/mp4")
    thumb_upload = storage.upload_file(str(thumb_path), f"videos/{task_id}/thumb.jpg", content_type="image/jpeg")

    hls_url = None
    if playlist.exists():
        for root, _dirs, files in os.walk(hls_dir):
            for name in files:
                local = Path(root) / name
                rel = local.relative_to(hls_dir).as_posix()
                content_type = "application/vnd.apple.mpegurl" if name.endswith(".m3u8") else "video/MP2T"
                upload = storage.upload_file(str(local), f"videos/{task_id}/hls/{rel}", content_type=content_type)
                if name == "index.m3u8":
                    hls_url = upload.url

    return {
        "url": video_upload.url,
        "thumbnailUrl": thumb_upload.url,
        "hlsUrl": hls_url,
        "metadata": {
            **(metadata or {}),
            "hls_playlist": str(playlist),
            "duration": round(probe_duration(str(final_path)), 2),
        },
    }


def public_file_url(path: str) -> Optional[str]:
    """Public URL for a file that lives under the media directory."""
    settings = get_settings()
    root = Path(settings.media_dir).resolve()
    try:
        relative = Path(path).resolve().relative_to(root)
    except ValueError:
        return None
    return f"{settings.media_base_url.rstrip('/')}/files/{relative.as_posix()}"
