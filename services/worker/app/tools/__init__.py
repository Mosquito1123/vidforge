"""Registry for the non-generative AI video tools."""

from __future__ import annotations

from typing import Any, Callable, Dict

from app.tools.common import ProgressFn, finalize_video, public_file_url, report
from app.tools.editor import edit_video
from app.tools.voiceover import add_voiceover
from app.tools.watermark import remove_watermark

SUPPORTED_TOOLS = ("video-edit", "watermark-removal", "voiceover")


def _run_watermark(task_id: str, payload: Dict[str, Any], progress: ProgressFn) -> Dict[str, Any]:
    region = payload.get("region") or {}
    method = str(payload.get("method") or "auto")
    cleaned = remove_watermark(payload.get("sourceUrl", ""), region, method=method, progress=progress)
    report(progress, 45, "post_processing")
    return finalize_video(
        task_id,
        cleaned,
        metadata={"tool": "watermark-removal", "method": method, "region": region},
        progress=progress,
    )


def _run_edit(task_id: str, payload: Dict[str, Any], progress: ProgressFn) -> Dict[str, Any]:
    clips = payload.get("clips") or []
    edited, info = edit_video(
        list(clips),
        trim_start=float(payload.get("trimStart") or 0),
        trim_end=float(payload["trimEnd"]) if payload.get("trimEnd") not in (None, "", 0) else None,
        bgm=payload.get("bgmUrl") or None,
        bgm_volume=float(payload.get("bgmVolume") or 0.25),
        caption=payload.get("caption") or None,
        progress=progress,
    )
    report(progress, 80, "post_processing")
    return finalize_video(
        task_id,
        edited,
        metadata={"tool": "video-edit", **info},
        progress=progress,
    )


def _run_voiceover(task_id: str, payload: Dict[str, Any], progress: ProgressFn) -> Dict[str, Any]:
    script = str(payload.get("script") or "").strip()
    voiced, metadata = add_voiceover(
        script=script,
        video=payload.get("videoUrl") or None,
        voice=payload.get("voice") or None,
        bgm=payload.get("bgmUrl") or None,
        bgm_volume=float(payload.get("bgmVolume") or 0.15),
        keep_original_audio=bool(payload.get("keepOriginalAudio", True)),
        burn_subtitles=bool(payload.get("burnSubtitles", True)),
        progress=progress,
    )
    report(progress, 80, "post_processing")
    result = finalize_video(task_id, voiced, metadata=metadata, progress=progress)
    srt_path = (result.get("metadata") or {}).pop("srtPath", None)
    if srt_path:
        url = public_file_url(srt_path)
        if url:
            result["metadata"]["subtitlesUrl"] = url
    return result


_RUNNERS: Dict[str, Callable[[str, Dict[str, Any], ProgressFn], Dict[str, Any]]] = {
    "watermark-removal": _run_watermark,
    "video-edit": _run_edit,
    "voiceover": _run_voiceover,
}


def run_tool(tool: str, task_id: str, payload: Dict[str, Any], progress: ProgressFn = None) -> Dict[str, Any]:
    runner = _RUNNERS.get(tool)
    if runner is None:
        raise ValueError(f"Unsupported tool: {tool}")
    return runner(task_id, payload, progress)
