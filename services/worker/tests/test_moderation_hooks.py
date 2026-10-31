from app.moderation.content_moderation import ContentModerator, ModerationVerdict


def test_moderate_text_rejects_banned():
    m = ContentModerator()
    r = m.moderate_text("this is violence")
    assert r.verdict == ModerationVerdict.REJECTED


def test_assert_safe_raises():
    m = ContentModerator()
    try:
        m.assert_safe("nsfw content")
        assert False
    except ValueError as e:
        assert "rejected" in str(e).lower() or "nsfw" in str(e).lower()


def test_pre_hooks_run():
    m = ContentModerator()
    calls = []
    m.register_pre_hook(lambda t: calls.append(t))
    m.assert_safe("hello")
    assert calls == ["hello"]


def test_post_hooks_run():
    m = ContentModerator()
    calls = []
    m.register_post_hook(lambda p: calls.append(p))
    m.run_post_hooks("/tmp/x.mp4")
    assert calls == ["/tmp/x.mp4"]
