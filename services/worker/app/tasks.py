"""Celery task definitions."""

from __future__ import annotations

import uuid
import time

from celery import states
from celery.exceptions import Ignore

from app.celery_app import celery
from app.config import get_settings
from app.events import publisher as event_publisher_module

_original_publish_event = event_publisher_module.publish_event

def _publish_event(event, *, key=None, topic=None):
    local = globals().get('publish_event')
    if local is not None and local is not _publish_event and local is not _original_publish_event:
        return local(event, key=key, topic=topic)
    return event_publisher_module.publish_event(event, key=key, topic=topic)

publish_event = _original_publish_event
from app.processors.task_processor import TaskCancelled, TaskInput, TaskProcessor
from app.progress import report_progress


def _is_retryable(error: str | None) -> bool:
    if not error:
        return False
    lowered = error.lower()
    retryable_markers = [
        "timeout",
        "timed out",
        "connection",
        "temporarily",
        "rate limit",
        "429",
        "500",
        "502",
        "503",
        "504",
        "service unavailable",
        "network",
    ]
    non_retryable_markers = ["rejected by moderation", "cancelled", "invalid", "validation"]
    if any(m in lowered for m in non_retryable_markers):
        return False
    return any(m in lowered for m in retryable_markers)


@celery.task(bind=True, name="app.tasks.generate_video")
def generate_video(self, payload: dict) -> dict:
    settings = get_settings()
    task_id = payload.get("task_id") or self.request.id or str(uuid.uuid4())
    _started_at = time.monotonic()

    def _update_state(*args, **kwargs):
        """Best-effort Celery state update; never break the pipeline."""
        try:
            self.update_state(*args, **kwargs)
        except Exception:  # noqa: BLE001
            pass

    processor = TaskProcessor()
    task_input = TaskInput(
        prompt=payload.get("prompt", ""),
        negative_prompt=payload.get("negative_prompt", ""),
        duration_seconds=float(payload.get("duration_seconds", 5.0)),
        width=int(payload.get("width", 1280)),
        height=int(payload.get("height", 720)),
        fps=int(payload.get("fps", 24)),
        seed=payload.get("seed"),
        extra=payload.get("extra") or {},
    )

    def cancel_check() -> bool:
        try:
            from celery.result import AsyncResult

            # Revocation is tracked against the Celery task id, not the API id.
            res = AsyncResult(self.request.id or task_id, app=celery)
            return res.state == "REVOKED"
        except Exception:  # noqa: BLE001
            return False

    _update_state(state="QUEUED", meta={"task_id": task_id, "status": "queued", "progress": 0, "stage": "queued"})
    report_progress(task_id, "queued", 0, stage="queued")
    _publish_event(
        {"type": "task.queued", "event_type": "task.queued", "task_id": task_id,
         "user_id": payload.get("user_id"), "status": "queued", "progress": 0, "stage": "queued"},
        key=task_id,
    )

    _update_state(state="RUNNING", meta={"task_id": task_id, "status": "running", "progress": 5, "stage": "running"})
    report_progress(task_id, "running", 5, stage="running")
    _publish_event(
        {"type": "task.running", "event_type": "task.running", "task_id": task_id,
         "user_id": payload.get("user_id"), "status": "running", "progress": 5, "stage": "running"},
        key=task_id,
    )

    def progress_callback(progress: int, stage: str) -> None:
        status = "post_processing" if stage == "post_processing" else "running"
        _update_state(state=stage.upper(), meta={"task_id": task_id, "status": status, "progress": progress, "stage": stage})
        report_progress(task_id, status, progress, stage=stage)
        event_type = "task.post_processing" if stage == "post_processing" else "task.running"
        _publish_event(
            {"type": event_type, "event_type": event_type, "task_id": task_id,
             "user_id": payload.get("user_id"), "status": status, "progress": progress, "stage": stage},
            key=task_id,
        )

    result = processor.process(task_id, task_input, progress_callback=progress_callback, cancel_check=cancel_check)

    if result.status == "cancelled":
        _update_state(state="REVOKED", meta={"task_id": task_id, "status": "cancelled", "progress": 100, "stage": "cancelled"})
        report_progress(task_id, "cancelled", 100, stage="cancelled")
        _publish_event(
            {"type": "task.cancelled", "event_type": "task.cancelled", "task_id": task_id,
             "user_id": payload.get("user_id"), "status": "cancelled", "progress": 100, "stage": "cancelled"},
            key=task_id,
        )
        _publish_event(
            {"type": "task.metrics", "event_type": "task.metrics", "task_id": task_id,
             "user_id": payload.get("user_id"), "status": "cancelled",
             "duration_seconds": time.monotonic() - _started_at, "cost": payload.get("cost", 0)},
            key=task_id,
        )
        raise Ignore()

    if result.status == "failed":
        # Retry with backoff for transient errors.
        if _is_retryable(result.error) and self.request.retries < settings.task_max_retries:
            countdown = min(
                settings.task_retry_backoff_max,
                settings.task_retry_backoff_seconds * (2 ** self.request.retries),
            )
            raise self.retry(exc=Exception(result.error or "transient failure"), countdown=countdown, max_retries=settings.task_max_retries)
        _update_state(state=states.FAILURE, meta={"task_id": task_id, "status": "failed", "progress": 100, "stage": "failed", "error": result.error})
        report_progress(task_id, "failed", 100, stage="failed", error=result.error)
        _publish_event(
            {"type": "task.failed", "event_type": "task.failed", "task_id": task_id,
             "user_id": payload.get("user_id"), "status": "failed", "progress": 100, "stage": "failed", "error": result.error},
            key=task_id,
        )
        _publish_event(
            {"type": "task.metrics", "event_type": "task.metrics", "task_id": task_id,
             "user_id": payload.get("user_id"), "status": "failed",
             "duration_seconds": time.monotonic() - _started_at, "cost": payload.get("cost", 0), "error": result.error},
            key=task_id,
        )
        raise Ignore()

    # post-processing stage reported inside processor? report here
    report_progress(task_id, "post_processing", 80, stage="post_processing")
    _update_state(state="POST_PROCESSING", meta={"task_id": task_id, "status": "post_processing", "progress": 80, "stage": "post_processing"})
    _publish_event(
        {"type": "task.post_processing", "event_type": "task.post_processing", "task_id": task_id,
         "user_id": payload.get("user_id"), "status": "post_processing", "progress": 80, "stage": "post_processing"},
        key=task_id,
    )

    output = {
        "url": result.video_url,
        "thumbnailUrl": result.thumbnail_url,
        "hlsUrl": result.hls_url,
        "metadata": result.metadata,
    }
    _update_state(state="SUCCESS", meta={"task_id": task_id, "status": "done", "progress": 100, "stage": "done"})
    report_progress(task_id, "done", 100, stage="done", output=output)
    _publish_event(
        {"type": "task.completed", "event_type": "task.completed", "task_id": task_id,
         "user_id": payload.get("user_id"), "status": "done", "progress": 100, "stage": "done", "output": output},
        key=task_id,
    )
    _publish_event(
        {"type": "task.metrics", "event_type": "task.metrics", "task_id": task_id,
         "user_id": payload.get("user_id"), "status": "done",
         "duration_seconds": time.monotonic() - _started_at, "cost": payload.get("cost", 0)},
        key=task_id,
    )
    return result.__dict__


@celery.task(name="app.tasks.health_check")
def health_check() -> dict:
    return {"status": "ok"}


@celery.task(bind=True, name="app.tasks.run_media_tool")
def run_media_tool(self, payload: dict) -> dict:
    """Run a media tool pipeline (edit / watermark removal / voiceover).

    Mirrors ``generate_video``: reports progress to the API, publishes events,
    and returns the produced asset URLs.
    """
    from app.tools import run_tool

    settings = get_settings()
    task_id = payload.get("task_id") or self.request.id or str(uuid.uuid4())
    tool = payload.get("tool") or ""
    tool_input = payload.get("input") or {}
    started_at = time.monotonic()

    def _update_state(*args, **kwargs):
        try:
            self.update_state(*args, **kwargs)
        except Exception:  # noqa: BLE001
            pass

    def progress(value: int, stage: str) -> None:
        status = "post_processing" if stage == "post_processing" else "running"
        _update_state(state=stage.upper(), meta={"task_id": task_id, "status": status, "progress": value, "stage": stage})
        report_progress(task_id, status, value, stage=stage)
        _publish_event(
            {
                "type": "task.running" if stage != "post_processing" else "task.post_processing",
                "event_type": "task.running" if stage != "post_processing" else "task.post_processing",
                "task_id": task_id,
                "user_id": payload.get("user_id"),
                "tool": tool,
                "status": status,
                "progress": value,
                "stage": stage,
            },
            key=task_id,
        )

    _update_state(state="RUNNING", meta={"task_id": task_id, "status": "running", "progress": 5, "stage": "running"})
    report_progress(task_id, "running", 5, stage="running")

    try:
        result = run_tool(tool, task_id, tool_input, progress=progress)
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        _update_state(state=states.FAILURE, meta={"task_id": task_id, "status": "failed", "progress": 100, "stage": "failed", "error": message})
        report_progress(task_id, "failed", 100, stage="failed", error=message)
        _publish_event(
            {"type": "task.failed", "event_type": "task.failed", "task_id": task_id, "user_id": payload.get("user_id"), "tool": tool, "status": "failed", "progress": 100, "stage": "failed", "error": message},
            key=task_id,
        )
        raise Ignore()

    output = {
        "url": result.get("url"),
        "thumbnailUrl": result.get("thumbnailUrl"),
        "hlsUrl": result.get("hlsUrl"),
        "metadata": result.get("metadata") or {},
    }
    _update_state(state="SUCCESS", meta={"task_id": task_id, "status": "done", "progress": 100, "stage": "done"})
    report_progress(task_id, "done", 100, stage="done", output=output)
    _publish_event(
        {"type": "task.completed", "event_type": "task.completed", "task_id": task_id, "user_id": payload.get("user_id"), "tool": tool, "status": "done", "progress": 100, "stage": "done", "output": output},
        key=task_id,
    )
    _publish_event(
        {
            "type": "task.metrics",
            "event_type": "task.metrics",
            "task_id": task_id,
            "user_id": payload.get("user_id"),
            "tool": tool,
            "status": "done",
            "duration_seconds": time.monotonic() - started_at,
            "cost": 0,
        },
        key=task_id,
    )
    return output
