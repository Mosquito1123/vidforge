"""High-level task processor orchestrating a video generation job."""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from app.config import get_settings
from app.gateways import GenerationRequest, build_model_gateway
from app.moderation.content_moderation import ContentModerator
from app.postprocess.ffmpeg import FFmpegProcessor
from app.storage import build_storage

logger = logging.getLogger(__name__)


class TaskCancelled(Exception):
    """Raised when a task is cancelled cooperatively."""


@dataclass
class TaskInput:
    prompt: str
    negative_prompt: str = ""
    duration_seconds: float = 5.0
    width: int = 1280
    height: int = 720
    fps: int = 24
    seed: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskOutput:
    task_id: str
    status: str
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    hls_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class TaskProcessor:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.gateway = build_model_gateway()
        self.ffmpeg = FFmpegProcessor()
        self.storage = build_storage()
        self.moderator = ContentModerator()

    def process(
        self,
        task_id: str,
        task_input: TaskInput,
        progress_callback=None,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> TaskOutput:
        work_dir = Path("/tmp/ai-video") / task_id
        work_dir.mkdir(parents=True, exist_ok=True)

        def report(progress: int, stage: str) -> None:
            if progress_callback is not None:
                try:
                    progress_callback(progress, stage)
                except Exception:  # noqa: BLE001
                    pass

        def check_cancelled() -> None:
            if cancel_check is not None and cancel_check():
                raise TaskCancelled("Task cancelled by user")

        try:
            report(10, "running")
            check_cancelled()
            # 1. Moderate input prompt (pre-generation hook).
            self.moderator.assert_safe(task_input.prompt)
            if task_input.negative_prompt:
                self.moderator.assert_safe(task_input.negative_prompt)

            report(20, "running")
            check_cancelled()
            # 2. Generate via model gateway.
            gen_req = GenerationRequest(
                prompt=task_input.prompt,
                negative_prompt=task_input.negative_prompt,
                duration_seconds=task_input.duration_seconds,
                width=task_input.width,
                height=task_input.height,
                fps=task_input.fps,
                seed=task_input.seed,
                extra=task_input.extra,
            )
            gen_result = self.gateway.generate(gen_req)
            raw_path = gen_result.output_path

            report(50, "post_processing")
            check_cancelled()
            # 3. Post-process with FFmpeg (transcode + thumbnail + HLS).
            processed_path = str(work_dir / "final.mp4")
            self.ffmpeg.transcode(raw_path, processed_path)
            if not Path(processed_path).exists() or Path(processed_path).stat().st_size == 0:
                raise ValueError(
                    "Post-processing produced no output (ffmpeg transcode failed); "
                    "check the provider output and ffmpeg installation"
                )
            thumb_path = str(work_dir / "thumb.jpg")
            self.ffmpeg.generate_thumbnail(processed_path, thumb_path)

            hls_dir = work_dir / "hls"
            self.ffmpeg.generate_hls(processed_path, str(hls_dir), segment_duration=self.settings.hls_segment_duration)
            hls_playlist = hls_dir / "index.m3u8"

            # 4. Moderate output media (post-generation hook).
            mod = self.moderator.moderate_media(processed_path)
            self.moderator.run_post_hooks(processed_path)
            if mod.verdict.value == "rejected":
                raise ValueError(f"Output rejected by moderation: {mod.categories}")

            report(80, "post_processing")
            check_cancelled()
            # 5. Upload to S3.
            video_key = f"videos/{task_id}/final.mp4"
            thumb_key = f"videos/{task_id}/thumb.jpg"
            video_upload = self.storage.upload_file(processed_path, video_key, content_type="video/mp4")
            thumb_upload = self.storage.upload_file(thumb_path, thumb_key, content_type="image/jpeg")

            # Upload HLS artifacts.
            hls_url = None
            if hls_playlist.exists():
                for root, _dirs, files in os.walk(hls_dir):
                    for name in files:
                        local = Path(root) / name
                        rel = local.relative_to(hls_dir).as_posix()
                        key = f"videos/{task_id}/hls/{rel}"
                        content_type = "application/vnd.apple.mpegurl" if name.endswith(".m3u8") else "video/MP2T"
                        up = self.storage.upload_file(str(local), key, content_type=content_type)
                        if name == "index.m3u8":
                            hls_url = up.url

            return TaskOutput(
                task_id=task_id,
                status="completed",
                video_url=video_upload.url,
                thumbnail_url=thumb_upload.url,
                hls_url=hls_url,
                metadata={
                    "provider": gen_result.provider,
                    "model": gen_result.model,
                    "moderation": mod.verdict.value,
                    "raw_path": raw_path,
                    "hls_playlist": str(hls_playlist),
                },
            )
        except TaskCancelled as exc:
            logger.info("Task %s cancelled", task_id)
            return TaskOutput(task_id=task_id, status="cancelled", error=str(exc))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Task %s failed", task_id)
            return TaskOutput(task_id=task_id, status="failed", error=str(exc))
