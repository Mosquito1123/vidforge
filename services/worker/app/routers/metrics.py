"""Metrics endpoint (Prometheus text format)."""

from __future__ import annotations

from fastapi import APIRouter, Response

# Lightweight in-process counters. These are intentionally simple so the
# endpoint works without extra dependencies.
_counters: dict[str, int] = {
    "worker_events_published_total": 0,
    "worker_events_dropped_total": 0,
    "worker_tasks_processed_total": 0,
}


def inc(name: str, value: int = 1) -> None:
    _counters[name] = _counters.get(name, 0) + value


router = APIRouter()


@router.get("/metrics")
def metrics() -> Response:
    lines = []
    for name, value in _counters.items():
        lines.append(f"# TYPE {name} counter")
        lines.append(f"{name} {value}")
    lines.append("# TYPE worker_up gauge")
    lines.append("worker_up 1")
    body = "\n".join(lines) + "\n"
    return Response(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")