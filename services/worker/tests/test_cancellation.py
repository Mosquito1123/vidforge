from app.processors.task_processor import TaskInput, TaskProcessor


def test_cancellation_returns_cancelled():
    tp = TaskProcessor()
    result = tp.process("c1", TaskInput(prompt="hello"), cancel_check=lambda: True)
    assert result.status == "cancelled"


def test_no_cancellation_completes():
    tp = TaskProcessor()
    result = tp.process("c2", TaskInput(prompt="hello"), cancel_check=lambda: False)
    assert result.status == "completed"
