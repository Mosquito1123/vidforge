"""AI voiceover (口播): text-to-speech narration over a video."""

from __future__ import annotations

import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from app.tools.common import (
    ProgressFn,
    media_dir,
    probe_duration,
    report,
    resolve_media,
    run_ffmpeg,
)

# Rough speaking speed used to size a silent fallback track.
CHARS_PER_SECOND = 4.2


def _silent_track(duration: float, output: str) -> str:
    run_ffmpeg(["-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-t", f"{duration:.2f}", "-c:a", "aac", output])
    return output


def synthesize_speech(script: str, voice: Optional[str], output: str) -> tuple[str, str]:
    """Render speech audio. Returns (path, provider).

    Providers are tried in order: edge-tts (if installed) → macOS `say` →
    silent track. The provider is surfaced in task metadata so operators can
    tell whether a real TTS engine was used.
    """
    text_file = Path(output).with_suffix(".txt")
    text_file.write_text(script, encoding="utf-8")

    edge = shutil.which("edge-tts")
    if edge:
        aiff = str(Path(output).with_suffix(".mp3"))
        result = subprocess.run(
            [edge, "--voice", voice or "zh-CN-XiaoxiaoNeural", "--text", script, "--write-media", aiff],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 and Path(aiff).exists() and Path(aiff).stat().st_size > 0:
            run_ffmpeg(["-i", aiff, "-ar", "48000", "-ac", "2", "-c:a", "aac", output])
            if Path(output).exists() and Path(output).stat().st_size > 0:
                return output, "edge-tts"

    if shutil.which("say"):
        aiff = str(Path(output).with_suffix(".aiff"))
        command = ["say"]
        if voice:
            command += ["-v", voice]
        command += ["-o", aiff, script]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode == 0 and Path(aiff).exists() and Path(aiff).stat().st_size > 0:
            run_ffmpeg(["-i", aiff, "-ar", "48000", "-ac", "2", "-c:a", "aac", output])
            if Path(output).exists() and Path(output).stat().st_size > 0:
                return output, "say"

    duration = max(2.0, len(script) / CHARS_PER_SECOND)
    return _silent_track(duration, output), "silent-fallback"


def _srt(script: str, duration: float, output: str) -> str:
    sentences = [chunk.strip() for chunk in script.replace("！", "。").replace("!", "。").split("。") if chunk.strip()]
    if not sentences:
        sentences = [script]
    per = max(0.8, duration / len(sentences))

    def stamp(seconds: float) -> str:
        millis = int(round(seconds * 1000))
        hours, millis = divmod(millis, 3_600_000)
        minutes, millis = divmod(millis, 60_000)
        secs, millis = divmod(millis, 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    lines = []
    for index, sentence in enumerate(sentences):
        start = index * per
        end = min(duration, (index + 1) * per)
        lines.append(f"{index + 1}\n{stamp(start)} --> {stamp(end)}\n{sentence}\n")
    Path(output).write_text("\n".join(lines), encoding="utf-8")
    return output


def _background(duration: float, width: int, height: int, output: str) -> str:
    run_ffmpeg(
        [
            "-f", "lavfi",
            "-i", f"gradients=s={width}x{height}:d={duration:.2f}:speed=0.03",
            "-t", f"{duration:.2f}",
            "-r", "24",
            "-pix_fmt", "yuv420p",
            output,
        ]
    )
    return output


def add_voiceover(
    *,
    script: str,
    video: Optional[str] = None,
    voice: Optional[str] = None,
    bgm: Optional[str] = None,
    bgm_volume: float = 0.15,
    keep_original_audio: bool = True,
    burn_subtitles: bool = True,
    progress: ProgressFn = None,
) -> tuple[str, dict]:
    work = media_dir() / "voice" / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=True)

    report(progress, 20, "running")
    narration, provider = synthesize_speech(script, voice, str(work / "narration.m4a"))
    narration_duration = probe_duration(narration) or max(2.0, len(script) / CHARS_PER_SECOND)

    report(progress, 35, "running")
    if video:
        source = resolve_media(video)
        base = source
    else:
        base = _background(narration_duration, 1280, 720, str(work / "background.mp4"))

    # Fit the video to the narration length: pad the last frame when the clip
    # is shorter, cut it when it is longer.
    fitted = str(work / "fitted.mp4")
    run_ffmpeg(
        [
            "-i", base,
            "-t", f"{narration_duration:.2f}",
            "-vf", "tpad=stop_mode=clone:stop_duration=5",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-an",
            fitted,
        ]
    )
    if not Path(fitted).exists() or Path(fitted).stat().st_size == 0:
        fitted = base

    report(progress, 55, "post_processing")
    mixed = str(work / "mixed.mp4")
    inputs = ["-i", fitted, "-i", narration]
    filter_parts = []
    if bgm:
        inputs += ["-i", resolve_media(bgm)]
        filter_parts.append(f"[2:a]volume={max(0.0, min(1.0, bgm_volume))},aloop=loop=-1:size=2e9[bg]")
        filter_parts.append("[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[narr]")
        narration_label = "[narr]"
    else:
        narration_label = "[1:a]"

    if keep_original_audio and video:
        filter_parts.append(f"[0:a]volume=0.35[orig]")
        filter_parts.append(f"{narration_label}[orig]amix=inputs=2:duration=first:dropout_transition=2[aout]")
    else:
        filter_parts.append(f"{narration_label}anull[aout]")

    args = inputs + ["-filter_complex", ";".join(filter_parts), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-shortest", mixed]
    result = run_ffmpeg(args)
    if result.returncode != 0 or not Path(mixed).exists():
        # Last resort: narration only, keep visuals.
        run_ffmpeg(["-i", fitted, "-i", narration, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", mixed])

    current = mixed

    srt_path = _srt(script, narration_duration, str(work / "subtitles.srt"))

    if burn_subtitles:
        report(progress, 70, "post_processing")
        subtitled = str(work / "subtitled.mp4")
        escaped = str(srt_path).replace(":", "\\:").replace("'", "\\'")
        args = [
            "-i", current,
            "-vf", f"subtitles='{escaped}':force_style='Fontsize=20,Outline=1,MarginV=28'",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", subtitled,
        ]
        if run_ffmpeg(args).returncode == 0 and Path(subtitled).exists() and Path(subtitled).stat().st_size > 0:
            current = subtitled

    metadata = {
        "srtPath": srt_path,
        "ttsProvider": provider,
        "voice": voice or None,
        "narrationSeconds": round(narration_duration, 2),
        "subtitlesBurned": current != mixed,
        "tool": "voiceover",
    }
    return current, metadata
