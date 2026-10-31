"""Report task progress back to the API."""

from __future__ import annotations

import json
import logging
import os
import urllib.request
from typing import Any, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


def report_progress(
    task_id: str,
    status: str,
    progress: int,
    *,
    stage: Optional[str] = None,
    output: Optional[dict] = None,
    error: Optional[str] = None,
) -> bool:
    settings = get_settings()
    base = (settings.api_base_url or "").rstrip("/")
    if not base:
        return False
    url = f"{base}/tasks/{task_id}/status"
    payload: dict[str, Any] = {"status": status, "progress": progress}
    if stage is not None:
        payload["stage"] = stage
    if output is not None:
        payload["output"] = output
    if error is not None:
        payload["error"] = error

    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.api_internal_token:
        headers["Authorization"] = f"Bearer {settings.api_internal_token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to report progress for %s: %s", task_id, exc)
        return False