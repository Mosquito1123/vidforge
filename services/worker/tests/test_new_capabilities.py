import os
import subprocess
import tempfile

import pytest

from app.config import get_settings
from app.events.publisher import EventPublisher
from app.gateways import CircuitBreaker, build_model_gateway
from app.gateways.circuit_breaker import CircuitBreakerOpenError
from app.postprocess.ffmpeg import FFmpegProcessor


def _make_video(path: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", "1", "-c:v", "libx264", "-c:a", "aac", path,
        ],
        check=True, capture_output=True,
    )


def _make_audio(path: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", path],
        check=True, capture_output=True,
    )


def test_ffmpeg_super_resolution_video():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "src.mp4")
        _make_video(src)
        out = os.path.join(d, "sr.mp4")
        proc = FFmpegProcessor()
        res = proc.super_resolve_video(src, out, scale=2)
        assert "super_resolution" in res.operations
        assert os.path.exists(out)


def test_ffmpeg_frame_interpolation():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "src.mp4")
        _make_video(src)
        out = os.path.join(d, "interp.mp4")
        proc = FFmpegProcessor()
        res = proc.interpolate_frames(src, out, multiplier=2)
        assert "rife" in res.operations
        assert os.path.exists(out)


def test_ffmpeg_subtitle_generation():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "src.mp4")
        _make_video(src)
        out = os.path.join(d, "sub.srt")
        proc = FFmpegProcessor()
        res = proc.generate_subtitles(src, out)
        assert "whisper" in res.operations
        assert os.path.exists(out)


def test_ffmpeg_audio_mixing():
    with tempfile.TemporaryDirectory() as d:
        narr = os.path.join(d, "narr.wav")
        bgm = os.path.join(d, "bgm.wav")
        _make_audio(narr)
        _make_audio(bgm)
        out = os.path.join(d, "mix.m4a")
        proc = FFmpegProcessor()
        res = proc.mix_audio(narr, bgm, out)
        assert "mix_audio" in res.operations
        assert os.path.exists(out)


def test_provider_health_check_endpoint():
    import fastapi.testclient as tc
    from app.main import app

    client = tc.TestClient(app)
    resp = client.get("/health/provider")
    assert resp.status_code == 200
    data = resp.json()
    assert "healthy" in data
    assert data["status"] in {"ok", "degraded"}


def test_circuit_breaker():
    cb = CircuitBreaker(failure_threshold=2, recovery_timeout=1000)
    assert cb.allow_request() is True
    cb.record_failure()
    cb.record_failure()
    assert cb.is_open is True
    assert cb.allow_request() is False
    cb.reset()
    assert cb.is_closed is True


def test_task_metrics_publisher():
    pub = EventPublisher()
    captured = []

    def fake_publish(event, *, key=None, topic=None):
        captured.append(event)
        return True

    pub.publish = fake_publish
    pub.publish_task_metrics(task_id="t1", duration_seconds=3.5, cost=0.42)
    assert captured
    assert captured[0]["duration_seconds"] == 3.5
    assert captured[0]["cost"] == 0.42
