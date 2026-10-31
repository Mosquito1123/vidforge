"""Task enqueue / status router."""

from __future__ import annotations

from typing import Any, Dict

from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.celery_app import celery
from app.tasks import generate_video, run_media_tool

router = APIRouter(prefix="/tasks", tags=["tasks"])


class CreateTaskRequest(BaseModel):
    # `task_id` is the API-side task id. Progress callbacks are addressed with
    # it, so it must be carried through to the Celery task verbatim.
    task_id: str | None = None
    user_id: str | None = None
    # Tool pipelines: video-edit | watermark-removal | voiceover
    # Omitted or "generate" => text/image to video generation.
    tool: str | None = None
    input: Dict[str, Any] | None = None
    prompt: str = Field(default="", max_length=4000)
    negative_prompt: str = ""
    duration_seconds: float = 5.0
    width: int = 1280
    height: int = 720
    fps: int = 24
    seed: int | None = None
    extra: Dict[str, Any] = Field(default_factory=dict)


@router.post("")
def create_task(req: CreateTaskRequest) -> dict:
    tool = (req.tool or "generate").strip().lower()
    if tool != "generate":
        async_result = run_media_tool.delay(
            {
                "task_id": req.task_id,
                "user_id": req.user_id,
                "tool": tool,
                "input": req.input or {},
            }
        )
        return {"task_id": req.task_id or async_result.id, "status": "queued", "tool": tool}

    async_result = generate_video.delay(req.model_dump())
    return {"task_id": async_result.id, "status": "queued"}


@router.get("/{task_id}")
def get_task(task_id: str) -> dict:
    res = AsyncResult(task_id, app=celery)
    state = res.state
    info = res.info if isinstance(res.info, dict) else {"detail": str(res.info)}
    payload: dict = {"task_id": task_id, "status": state.lower()}
    if state == "SUCCESS":
        payload["result"] = res.result
    elif state == "FAILURE":
        payload["error"] = str(res.result) if res.result else info.get("error")
    else:
        payload["meta"] = info
    return payload


@router.delete("/{task_id}")
def cancel_task(task_id: str) -> dict:
    celery.control.revoke(task_id, terminate=True)
    return {"task_id": task_id, "status": "revoked"}