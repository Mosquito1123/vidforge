"""Celery application factory."""

from __future__ import annotations

from celery import Celery
from kombu import Queue

from app.config import get_settings

settings = get_settings()

celery = Celery(
    "ai_video_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.task_time_limit,
    task_soft_time_limit=settings.task_soft_time_limit,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    result_expires=86400,
)

# Route all tasks to a dedicated queue.
celery.conf.task_routes = {"app.tasks.*": {"queue": "video"}}

# The worker must consume the routed queue by default. Without declaring
# `task_queues`, `celery worker` only listens on the "celery" queue and every
# task published to "video" stays there forever.
celery.conf.task_default_queue = "video"
celery.conf.task_queues = (Queue("video"), Queue("celery"))

if __name__ == "__main__":
    celery.start()