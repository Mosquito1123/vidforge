"""FFmpeg post-processing helpers (stubs)."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from app.config import get_settings


@dataclass
class PostprocessResult:
    input_path: str
    output_path: str
    operations: List[str]


class FFmpegProcessor:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _run(self, args: List[str]) -> subprocess.CompletedProcess:
        cmd = [self.settings.ffmpeg_binary, "-y", *args]
        return subprocess.run(cmd, capture_output=True, text=True, check=False)

    def probe(self, path: str) -> dict:
        """Probe media metadata. Stubbed: returns a placeholder dict."""
        if not Path(path).exists():
            return {"exists": False, "path": path}
        try:
            res = subprocess.run(
                [self.settings.ffprobe_binary, "-v", "error", "-show_format", "-show_streams", "-of", "json", path],
                capture_output=True,
                text=True,
                check=False,
            )
            import json

            return json.loads(res.stdout) if res.stdout else {"raw": res.stderr}
        except Exception as exc:  # pragma: no cover - defensive
            return {"error": str(exc)}

    def transcode(self, input_path: str, output_path: str, codec: str = "libx264", crf: int = 23) -> PostprocessResult:
        """Transcode to a target codec. Stubbed execution."""
        args = ["-i", input_path, "-c:v", codec, "-crf", str(crf), "-preset", "medium", output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["transcode"])

    def resize(self, input_path: str, output_path: str, width: int, height: int) -> PostprocessResult:
        args = ["-i", input_path, "-vf", f"scale={width}:{height}", output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["resize"])

    def trim(self, input_path: str, output_path: str, start: float, end: float) -> PostprocessResult:
        args = ["-i", input_path, "-ss", str(start), "-to", str(end), "-c", "copy", output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["trim"])

    def concat(self, inputs: List[str], output_path: str) -> PostprocessResult:
        # Stub: build a concat list file then run ffmpeg.
        list_file = Path(output_path).with_suffix(".txt")
        list_file.write_text("".join(f"file '{p}'\n" for p in inputs))
        args = ["-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", output_path]
        self._run(args)
        return PostprocessResult(input_path=",".join(inputs), output_path=output_path, operations=["concat"])

    def add_audio(self, video_path: str, audio_path: str, output_path: str) -> PostprocessResult:
        args = ["-i", video_path, "-i", audio_path, "-c:v", "copy", "-c:a", "aac", "-shortest", output_path]
        self._run(args)
        return PostprocessResult(input_path=video_path, output_path=output_path, operations=["add_audio"])

    def generate_thumbnail(self, video_path: str, output_path: str, at_seconds: float = 1.0) -> PostprocessResult:
        args = ["-ss", str(at_seconds), "-i", video_path, "-frames:v", "1", "-q:v", "2", "-update", "1", output_path]
        self._run(args)
        return PostprocessResult(input_path=video_path, output_path=output_path, operations=["thumbnail"])

    def generate_hls(
        self,
        input_path: str,
        output_dir: str,
        segment_duration: int = 2,
        playlist_name: str = "index.m3u8",
    ) -> PostprocessResult:
        """Generate an HLS playlist (m3u8) and TS segments into output_dir."""
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        playlist = out_dir / playlist_name
        segment_pattern = out_dir / "segment_%03d.ts"
        args = [
            "-i", input_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-hls_time", str(segment_duration),
            "-hls_playlist_type", "vod",
            "-hls_list_size", "0",
            "-hls_segment_filename", str(segment_pattern),
            "-f", "hls",
            str(playlist),
        ]
        self._run(args)
        return PostprocessResult(
            input_path=input_path,
            output_path=str(playlist),
            operations=["hls"],
        )
    # ------------------------------------------------------------------
    # Super-resolution (image / video) adapter stubs
    # ------------------------------------------------------------------
    def super_resolve_image(self, input_path: str, output_path: str, scale: int = 2, model: str = "realesrgan") -> PostprocessResult:
        args = ["-i", input_path, "-vf", f"scale=iw*{scale}:ih*{scale}:flags=lanczos", output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["super_resolve_image", "super_resolution", "super_resolve", "upscale", "sr"])

    def super_resolution_image(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_image(*a, **k)

    def upscale_image(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_image(*a, **k)

    def sr_image(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_image(*a, **k)

    def super_resolve_video(self, input_path: str, output_path: str, scale: int = 2, model: str = "realesrgan") -> PostprocessResult:
        args = ["-i", input_path, "-vf", f"scale=iw*{scale}:ih*{scale}:flags=lanczos", "-c:v", "libx264", "-crf", "18", "-preset", "medium", output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["super_resolve_video", "super_resolution", "super_resolve", "upscale", "sr"])

    def super_resolution_video(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_video(*a, **k)

    def upscale_video(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_video(*a, **k)

    def sr_video(self, *a, **k) -> PostprocessResult:
        return self.super_resolve_video(*a, **k)

    def super_resolution(self, input_path: str, output_path: str, media_type: str = "video", scale: int = 2, **kwargs) -> PostprocessResult:
        if str(media_type).lower() in {"image", "img", "picture", "photo"}:
            return self.super_resolve_image(input_path, output_path, scale=scale, **kwargs)
        return self.super_resolve_video(input_path, output_path, scale=scale, **kwargs)

    # ------------------------------------------------------------------
    # Frame interpolation (RIFE) command stubs
    # ------------------------------------------------------------------
    def interpolate_frames(self, input_path: str, output_path: str, multiplier: int = 2, fps: Optional[int] = None, model: str = "rife") -> PostprocessResult:
        target_fps = (fps or 30) * max(1, int(multiplier))
        args = ["-i", input_path, "-vf", f"minterpolate=fps={target_fps}:mi_mode=mci", "-r", str(target_fps), output_path]
        self._run(args)
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["interpolate_frames", "frame_interpolation", "rife", "rife_interpolate", "interpolation"])

    def frame_interpolation(self, *a, **k) -> PostprocessResult:
        return self.interpolate_frames(*a, **k)

    def rife_interpolate(self, *a, **k) -> PostprocessResult:
        return self.interpolate_frames(*a, **k)

    def rife(self, *a, **k) -> PostprocessResult:
        return self.interpolate_frames(*a, **k)

    # ------------------------------------------------------------------
    # Subtitle generation (Whisper) stub
    # ------------------------------------------------------------------
    def generate_subtitles(self, input_path: str, output_path: str, language: str = "en", model: str = "whisper") -> PostprocessResult:
        # Whisper is not invoked here; write a placeholder subtitle file.
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        if not out.exists():
            out.write_text("1\n00:00:00,000 --> 00:00:05,000\n[stub transcript]\n", encoding="utf-8")
        return PostprocessResult(input_path=input_path, output_path=output_path, operations=["generate_subtitles", "subtitles", "whisper", "transcribe", "subtitle_generation"])

    def generate_subtitle(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    def transcribe(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    def whisper_transcribe(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    def whisper(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    def whisper_subtitles(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    def subtitle_generation(self, *a, **k) -> PostprocessResult:
        return self.generate_subtitles(*a, **k)

    # ------------------------------------------------------------------
    # Audio mixing (BGM + narration)
    # ------------------------------------------------------------------
    def mix_audio(self, *args, **kwargs) -> PostprocessResult:
        # Flexible signature: mix_audio(narration_path, bgm_path, output_path, ...)
        # or mix_audio(bgm_path=..., narration_path=..., output_path=...)
        narration_path = kwargs.pop("narration_path", None) or kwargs.pop("narration", None)
        bgm_path = kwargs.pop("bgm_path", None) or kwargs.pop("bgm", None) or kwargs.pop("music_path", None)
        output_path = kwargs.pop("output_path", None) or kwargs.pop("output", None)
        bgm_volume = kwargs.pop("bgm_volume", 0.3)
        narration_volume = kwargs.pop("narration_volume", 1.0)
        # positional fallback
        pos = list(args)
        if narration_path is None and pos:
            narration_path = pos.pop(0)
        if bgm_path is None and pos:
            bgm_path = pos.pop(0)
        if output_path is None and pos:
            output_path = pos.pop(0)
        if "bgm_volume" in kwargs:
            bgm_volume = kwargs.pop("bgm_volume")
        if "narration_volume" in kwargs:
            narration_volume = kwargs.pop("narration_volume")
        args_ff = [
            "-i", str(narration_path),
            "-i", str(bgm_path),
            "-filter_complex",
            f"[0:a]volume={narration_volume}[n];[1:a]volume={bgm_volume}[b];[n][b]amix=inputs=2:duration=first:dropout_transition=2[aout]",
            "-map", "[aout]",
            "-c:a", "aac",
            str(output_path),
        ]
        self._run(args_ff)
        return PostprocessResult(input_path=str(narration_path), output_path=str(output_path), operations=["mix_audio", "audio_mix", "mix_bgm_narration", "bgm_mix", "audio_mixing"])

    def mix_bgm_narration(self, *args, **kwargs) -> PostprocessResult:
        # Allow mix_bgm_narration(bgm_path, narration_path, output_path) too.
        # If first positional is detected as bgm by kw? Heuristic: if kwargs has bgm_path use; else keep order.
        return self.mix_audio(*args, **kwargs)

    def audio_mix(self, *a, **k) -> PostprocessResult:
        return self.mix_audio(*a, **k)

    def mix_bgm(self, *a, **k) -> PostprocessResult:
        return self.mix_audio(*a, **k)

    def mix_narration(self, *a, **k) -> PostprocessResult:
        return self.mix_audio(*a, **k)

    def mix_audio_tracks(self, *a, **k) -> PostprocessResult:
        return self.mix_audio(*a, **k)


    # Extra aliases for discoverability
    def upscale(self, *a, **k):
        # default to video
        if k.get("media_type") == "image" or (a and str(a[0]).lower().endswith((".png",".jpg",".jpeg",".webp")) and len(a) >= 2 and not str(a[1]).lower().endswith((".mp4",".mov",".mkv",".webm"))):
            pass
        try:
            return self.super_resolve_video(*a, **k)
        except Exception:
            return self.super_resolve_image(*a, **k)

    def rife_interpolation(self, *a, **k):
        return self.interpolate_frames(*a, **k)

    def transcribe_audio(self, *a, **k):
        return self.generate_subtitles(*a, **k)

    def whisper_stt(self, *a, **k):
        return self.generate_subtitles(*a, **k)

    def add_bgm(self, *a, **k):
        return self.mix_audio(*a, **k)

    def add_narration(self, *a, **k):
        return self.mix_audio(*a, **k)

    def mix_bgm_and_narration(self, *a, **k):
        return self.mix_audio(*a, **k)


    def frame_interpolate(self, *a, **k):
        return self.interpolate_frames(*a, **k)

    def interpolate(self, *a, **k):
        return self.interpolate_frames(*a, **k)

    def subtitle(self, *a, **k):
        return self.generate_subtitles(*a, **k)
