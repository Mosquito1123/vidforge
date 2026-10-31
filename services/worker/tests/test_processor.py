import os
import tempfile

from app.processors.task_processor import TaskInput, TaskProcessor


def test_processor_completes_in_mock_mode():
    processor = TaskProcessor()
    result = processor.process("t1", TaskInput(prompt="hello world"))
    assert result.status == "completed"
    assert result.video_url is not None


def test_moderation_rejects_banned():
    processor = TaskProcessor()
    result = processor.process("t2", TaskInput(prompt="this is violence"))
    assert result.status == "failed"
    assert "rejected" in (result.error or "").lower() or "violence" in (result.error or "").lower()