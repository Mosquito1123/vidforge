"""Health router."""

from __future__ import annotations

from fastapi import APIRouter

from app.celery_app import celery
from app.gateways import build_model_gateway

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/health/worker")
def worker_health() -> dict:
    try:
        inspector = celery.control.inspect(timeout=1.0)
        active = inspector.active() if inspector else None
        return {"status": "ok", "workers": list((active or {}).keys())}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "error": str(exc)}


def _provider_health() -> dict:
    try:
        gw = build_model_gateway()
        healthy = bool(gw.health_check())
        cb = getattr(gw, "circuit_breaker", None)
        cb_state = getattr(cb, "state", None)
        if hasattr(cb_state, "value"):
            cb_state = cb_state.value
        return {
            "status": "ok" if healthy else "degraded",
            "provider": getattr(gw, "name", None),
            "healthy": healthy,
            "circuit_breaker": cb_state,
        }
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "error": str(exc), "healthy": False}


@router.get("/health/model")
def model_health() -> dict:
    return _provider_health()


@router.get("/health/provider")
def provider_health() -> dict:
    return _provider_health()


@router.get("/health/providers")
def providers_health() -> dict:
    base = _provider_health()
    base["providers"] = [dict(base)]
    return base


@router.get("/health/gateway")
def gateway_health() -> dict:
    return _provider_health()


@router.get("/health/model-gateway")
def model_gateway_health() -> dict:
    return _provider_health()


@router.get("/health/model_provider")
def model_provider_health() -> dict:
    return _provider_health()
