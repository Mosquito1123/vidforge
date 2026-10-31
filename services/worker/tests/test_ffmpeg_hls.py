import os
import subprocess
import tempfile

import pytest

from app.postprocess.ffmpeg import FFmpegProcessor


def _make_video(path: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", "2", "-c:v", "libx264", "-c:a", "aac", path,
        ],
        check=True, capture_output=True,
    )


def test_generate_thumbnail_creates_file():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "src.mp4")
        _make_video(src)
        out = os.path.join(d, "thumb.jpg")
        proc = FFmpegProcessor()
        res = proc.generate_thumbnail(src, out)
        assert os.path.exists(out)
        assert os.path.getsize(out) > 0
        assert "thumbnail" in res.operations


def test_generate_hls_creates_playlist_and_segments():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "src.mp4")
        _make_video(src)
        hls_dir = os.path.join(d, "hls")
        proc = FFmpegProcessor()
        res = proc.generate_hls(src, hls_dir, segment_duration=1)
        playlist = os.path.join(hls_dir, "index.m3u8")
        assert os.path.exists(playlist)
        assert os.path.getsize(playlist) > 0
        segments = [f for f in os.listdir(hls_dir) if f.endswith(".ts")]
        assert len(segments) >= 1
        assert "hls" in res.operations
        content = open(playlist).read()
        assert "#EXTM3U" in content
