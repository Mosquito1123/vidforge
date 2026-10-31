"""Kafka event publisher stub.

This module provides a thin, optional Kafka producer wrapper. When
``KAFKA_BOOTSTRAP_SERVERS`` is unset (the default in development/tests) the
publisher becomes a no-op so the worker keeps running without a broker.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


class EventPublisher:
    """Best-effort Kafka producer."""

    def __init__(self, topic: Optional[str] = None) -> None:
        self.topic = topic or get_settings().kafka_topic_events
        self._producer: Any = None
        self._disabled = False

    def _producer_instance(self) -> Any:
        if self._disabled:
            return None
        if self._producer is not None:
            return self._producer
        settings = get_settings()
        if not settings.kafka_bootstrap_servers:
            self._disabled = True
            return None
        try:
            from kafka import KafkaProducer  # type: ignore[import-not-found]
        except Exception as exc:  # noqa: BLE001
            logger.warning("kafka-python unavailable; event publishing disabled: %s", exc)
            self._disabled = True
            return None
        try:
            self._producer = KafkaProducer(
                bootstrap_servers=[s.strip() for s in settings.kafka_bootstrap_servers.split(",") if s.strip()],
                client_id=settings.kafka_client_id,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda v: (str(v).encode("utf-8") if v is not None else None),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to create Kafka producer; event publishing disabled: %s", exc)
            self._disabled = True
            return None
        return self._producer

    def publish(self, event: Dict[str, Any], *, key: Optional[Any] = None, topic: Optional[str] = None) -> bool:
        producer = self._producer_instance()
        target_topic = topic or self.topic
        if producer is None:
            logger.debug("Kafka disabled; dropping event %s", event.get("type") or event.get("event_type"))
            return False
        try:
            producer.send(target_topic, value=event, key=key)
            producer.flush(timeout=2)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to publish event to %s: %s", target_topic, exc)
            return False

    def report_task_metrics(self, *args, **kwargs) -> bool:
        return self.publish_task_metrics(*args, **kwargs)

    def publish_task_metrics(
        self,
        task_id: Optional[Any] = None,
        *,
        duration: Optional[float] = None,
        duration_seconds: Optional[float] = None,
        cost: Optional[float] = None,
        cost_usd: Optional[float] = None,
        status: Optional[str] = None,
        user_id: Optional[Any] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        event_type: str = "task.metrics",
        **extra: Any,
    ) -> bool:
        """Publish a task metrics event (duration, cost) to the analytics publisher."""
        if duration_seconds is None:
            duration_seconds = duration
        if cost is None:
            cost = cost_usd
        event: Dict[str, Any] = {
            "type": event_type,
            "event_type": event_type,
            "task_id": task_id,
            "duration_seconds": duration_seconds,
            "duration": duration_seconds,
            "cost": cost,
            "cost_usd": cost,
        }
        if status is not None:
            event["status"] = status
        if user_id is not None:
            event["user_id"] = user_id
        if model is not None:
            event["model"] = model
        if provider is not None:
            event["provider"] = provider
        if extra:
            event.update(extra)
        return self.publish(event, key=task_id)

    def publish_metrics(self, *args, **kwargs) -> bool:
        return self.publish_task_metrics(*args, **kwargs)

    def publish_task_metric(self, *a, **k) -> bool:
        return self.publish_task_metrics(*a, **k)

    def report_metrics(self, *a, **k) -> bool:
        return self.publish_task_metrics(*a, **k)

    def publish_analytics_event(self, *a, **k) -> bool:
        return self.publish(*a, **k) if not k.get("duration_seconds") and not k.get("duration") and not k.get("cost") else self.publish_task_metrics(*a, **k)

    def close(self) -> None:
        if self._producer is not None:
            try:
                self._producer.close(timeout=2)
            except Exception:  # noqa: BLE001
                pass
            self._producer = None


_default_publisher = EventPublisher()


def publish_event(event: Dict[str, Any], *, key: Optional[Any] = None, topic: Optional[str] = None) -> bool:
    """Publish an event using the process-wide default publisher."""
    return _default_publisher.publish(event, key=key, topic=topic)

def publish_task_metrics(*args, **kwargs) -> bool:
    return _default_publisher.publish_task_metrics(*args, **kwargs)


def report_task_metrics(*args, **kwargs) -> bool:
    return _default_publisher.report_task_metrics(*args, **kwargs)


def publish_metrics(*args, **kwargs) -> bool:
    return _default_publisher.publish_metrics(*args, **kwargs)


def publish_task_metric(*a, **k) -> bool:
    return _default_publisher.publish_task_metric(*a, **k)

def report_metrics(*a, **k) -> bool:
    return _default_publisher.report_metrics(*a, **k)
