"""Model gateway abstraction and concrete providers."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from app.config import get_settings
from app.gateways.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError


@dataclass
class GenerationRequest:
    prompt: str
    negative_prompt: str = ""
    duration_seconds: float = 5.0
    width: int = 1280
    height: int = 720
    fps: int = 24
    seed: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationResult:
    provider: str
    model: str
    output_path: str  # local path or remote uri produced by provider
    metadata: Dict[str, Any] = field(default_factory=dict)


class ModelGateway(ABC):
    """Abstract interface for AI video/image model providers."""

    name: str = "abstract"
    circuit_breaker: Optional["CircuitBreaker"] = None

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult:
        """Generate media for the given request and return a result handle."""
        raise NotImplementedError

    def health(self) -> bool:
        return True

    def health_check(self) -> bool:
        """Provider health check. Combines basic health and circuit breaker state."""
        if self.circuit_breaker is not None and self.circuit_breaker.is_open:
            return False
        return bool(self.health())

    def check_health(self) -> bool:
        return self.health_check()

    def is_healthy(self) -> bool:
        return self.health_check()


class MockModelGateway(ModelGateway):
    """In-memory mock gateway used for development and tests.

    Renders a real (synthetic) clip so the rest of the pipeline — FFmpeg,
    thumbnails, HLS, storage, playback — behaves exactly like production.
    """

    name = "mock"

    def generate(self, request: GenerationRequest) -> GenerationResult:
        settings = get_settings()
        out_dir = Path(settings.media_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out = str(out_dir / f"{uuid.uuid4()}.mp4")

        duration = max(float(request.duration_seconds or 5.0), 1.0)
        width = request.width or 1280
        height = request.height or 720
        fps = request.fps or 24

        sources = [
            f"gradients=s={width}x{height}:d={duration}:speed=0.05",
            f"testsrc2=s={width}x{height}:r={fps}:d={duration}",
            f"color=c=0x1e3a8a:s={width}x{height}:d={duration}",
        ]
        for source in sources:
            proc = subprocess.run(
                [
                    settings.ffmpeg_binary,
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    source,
                    "-t",
                    str(duration),
                    "-r",
                    str(fps),
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    out,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if proc.returncode == 0 and Path(out).exists() and Path(out).stat().st_size > 0:
                break

        return GenerationResult(
            provider=self.name,
            model=get_settings().model_name,
            output_path=out,
            metadata={"prompt": request.prompt, "duration": duration, "width": width, "height": height},
        )


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _http_json(url: str, method: str = "POST", headers: Optional[dict] = None, body: Optional[dict] = None, timeout: int = 120) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {body_text}") from exc


def _download(url: str, dest: str, timeout: int = 300) -> str:
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ai-video-worker"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        with open(dest, "wb") as f:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                f.write(chunk)
    return dest


def _save_b64(b64: str, dest: str) -> str:
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(base64.b64decode(b64))
    return dest


def _new_output_path(ext: str = ".mp4") -> str:
    out_dir = Path("/tmp/ai-video")
    out_dir.mkdir(parents=True, exist_ok=True)
    return str(out_dir / f"{uuid.uuid4()}{ext}")


def _extract_url(payload: Any) -> Optional[str]:
    """Best-effort extraction of a media URL from a provider response."""
    if isinstance(payload, str):
        if payload.startswith("http://") or payload.startswith("https://") or payload.startswith("data:"):
            return payload
        return None
    if isinstance(payload, list):
        for item in payload:
            u = _extract_url(item)
            if u:
                return u
        return None
    if isinstance(payload, dict):
        # common keys
        for key in ("url", "output_url", "video_url", "file_url", "asset_url"):
            if key in payload:
                u = _extract_url(payload[key])
                if u:
                    return u
        for key in ("video", "output", "data", "result", "asset", "file"):
            if key in payload:
                u = _extract_url(payload[key])
                if u:
                    return u
        # b64
        for key in ("b64_json", "base64", "b64"):
            if key in payload and isinstance(payload[key], str):
                return None  # handled separately
    return None


def _extract_b64(payload: Any) -> Optional[str]:
    if isinstance(payload, dict):
        for key in ("b64_json", "base64", "b64"):
            if key in payload and isinstance(payload[key], str):
                return payload[key]
        for v in payload.values():
            r = _extract_b64(v)
            if r:
                return r
    elif isinstance(payload, list):
        for item in payload:
            r = _extract_b64(item)
            if r:
                return r
    return None


def _materialize(payload: Any, dest: Optional[str] = None) -> str:
    """Convert a provider payload into a local file path."""
    dest = dest or _new_output_path(".mp4")
    url = _extract_url(payload)
    if url:
        if url.startswith("data:"):
            # data URI
            header, b64 = url.split(",", 1)
            return _save_b64(b64, dest)
        return _download(url, dest)
    b64 = _extract_b64(payload)
    if b64:
        return _save_b64(b64, dest)
    raise RuntimeError(f"Could not extract media from provider response: {payload!r}")


# ---------------------------------------------------------------------------
# Adapters
# ---------------------------------------------------------------------------


class OpenAICompatibleGateway(ModelGateway):
    """Gateway for OpenAI-compatible video/image endpoints."""

    name = "openai"

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = (base_url or "https://api.openai.com").rstrip("/")
        self.model = model or "sora-2"

    def _endpoint(self) -> str:
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/videos/generations"
        return f"{self.base_url}/v1/videos/generations"

    def generate(self, request: GenerationRequest) -> GenerationResult:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {
            "model": self.model,
            "prompt": request.prompt,
            "size": f"{request.width}x{request.height}",
            "duration": request.duration_seconds,
            "n": 1,
        }
        if request.negative_prompt:
            body["negative_prompt"] = request.negative_prompt
        if request.seed is not None:
            body["seed"] = request.seed
        if request.extra:
            body.update(request.extra)

        payload = _http_json(self._endpoint(), headers=headers, body=body)
        out_path = _materialize(payload)
        return GenerationResult(
            provider=self.name,
            model=self.model,
            output_path=out_path,
            metadata={"prompt": request.prompt, "raw": payload},
        )


class ReplicateGateway(ModelGateway):
    """Gateway for Replicate-style providers."""

    name = "replicate"

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def generate(self, request: GenerationRequest) -> GenerationResult:
        if not self.api_key:
            raise RuntimeError("Replicate API token is required")
        headers = {"Authorization": f"Token {self.api_key}"}
        input_payload = {
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "width": request.width,
            "height": request.height,
            "duration": request.duration_seconds,
            "fps": request.fps,
        }
        if request.seed is not None:
            input_payload["seed"] = request.seed
        if request.extra:
            input_payload.update(request.extra)

        # Choose endpoint based on model form.
        if "/" in self.model and not _is_version_hash(self.model):
            url = f"https://api.replicate.com/v1/models/{self.model}/predictions"
            body = {"input": input_payload}
        else:
            url = "https://api.replicate.com/v1/predictions"
            body = {"version": self.model, "input": input_payload}

        created = _http_json(url, headers=headers, body=body)
        # Poll.
        get_url = (created.get("urls") or {}).get("get") or created.get("url")
        if not get_url:
            raise RuntimeError(f"Replicate did not return a polling URL: {created!r}")
        terminal = {"succeeded", "failed", "canceled"}
        status = created.get("status", "starting")
        result_payload = created
        deadline = time.time() + 600
        while status not in terminal:
            if time.time() > deadline:
                raise RuntimeError("Replicate prediction timed out")
            time.sleep(2)
            result_payload = _http_json(get_url, method="GET", headers=headers)
            status = result_payload.get("status", status)
        if status != "succeeded":
            raise RuntimeError(f"Replicate prediction {status}: {result_payload.get('error')}")
        out_path = _materialize(result_payload.get("output"))
        return GenerationResult(
            provider=self.name,
            model=self.model,
            output_path=out_path,
            metadata={"prompt": request.prompt, "raw": result_payload},
        )


def _is_version_hash(value: str) -> bool:
    return len(value) == 64 and all(c in "0123456789abcdef" for c in value.lower())


class FalGateway(ModelGateway):
    """Gateway for fal.ai endpoints."""

    name = "fal"

    def __init__(self, api_key: str, model: str, base_url: str = "https://fal.run") -> None:
        self.api_key = api_key
        self.model = model or "fal-ai/fast-animatediff"
        self.base_url = base_url.rstrip("/")

    def generate(self, request: GenerationRequest) -> GenerationResult:
        if not self.api_key:
            raise RuntimeError("FAL API key is required")
        headers = {"Authorization": f"Key {self.api_key}"}
        input_payload = {
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "image_size": {"width": request.width, "height": request.height},
            "num_frames": max(8, int(request.duration_seconds * request.fps)),
            "fps": request.fps,
        }
        if request.seed is not None:
            input_payload["seed"] = request.seed
        if request.extra:
            input_payload.update(request.extra)

        url = f"{self.base_url}/{self.model}"
        payload = _http_json(url, headers=headers, body=input_payload, timeout=300)
        out_path = _materialize(payload)
        return GenerationResult(
            provider=self.name,
            model=self.model,
            output_path=out_path,
            metadata={"prompt": request.prompt, "raw": payload},
        )


def _attach_circuit_breaker(gw: ModelGateway) -> ModelGateway:
    cb = CircuitBreaker(name=getattr(gw, "name", "model-gateway"))
    gw.circuit_breaker = cb
    original_generate = gw.generate

    def _guarded_generate(request: GenerationRequest) -> GenerationResult:
        if not cb.allow_request():
            raise CircuitBreakerOpenError(f"Circuit breaker '{cb.name}' is open")
        try:
            result = original_generate(request)
        except Exception as exc:  # noqa: BLE001
            cb.record_failure(exc)
            raise
        cb.record_success()
        return result

    gw.generate = _guarded_generate  # type: ignore[assignment]
    return gw


def build_model_gateway() -> ModelGateway:
    settings = get_settings()
    provider = settings.model_provider.lower()
    if provider == "mock":
        return _attach_circuit_breaker(MockModelGateway())
    if provider in {"openai", "openai-compatible"}:
        return _attach_circuit_breaker(OpenAICompatibleGateway(
            api_key=settings.model_api_key,
            base_url=settings.model_base_url,
            model=settings.model_name,
        ))
    if provider == "replicate":
        token = settings.replicate_api_token or settings.model_api_key
        return _attach_circuit_breaker(ReplicateGateway(api_key=token, model=settings.model_name))
    if provider in {"fal", "fal-ai", "fal.ai"}:
        model = settings.fal_model or settings.model_name or "fal-ai/fast-animatediff"
        return _attach_circuit_breaker(FalGateway(
            api_key=settings.fal_api_key or settings.model_api_key,
            model=model,
            base_url=settings.fal_base_url,
        ))
    raise ValueError(f"Unknown model provider: {settings.model_provider}")
