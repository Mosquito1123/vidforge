"""FastAPI application entrypoint."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import health, tasks, metrics

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(metrics.router)

# Serve generated media when running without object storage (local dev/preview).
os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/files", StaticFiles(directory=settings.media_dir), name="files")


@app.get("/")
def root() -> dict:
    return {"name": settings.app_name, "env": settings.app_env}
