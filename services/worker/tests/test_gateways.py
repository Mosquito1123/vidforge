import os

from app.config import get_settings
from app.gateways import build_model_gateway, MockModelGateway, OpenAICompatibleGateway, ReplicateGateway, FalGateway


def test_mock_default():
    os.environ.pop("MODEL_PROVIDER", None)
    get_settings.cache_clear()
    gw = build_model_gateway()
    assert isinstance(gw, MockModelGateway)


def test_factory_openai(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("MODEL_API_KEY", "k")
    monkeypatch.setenv("MODEL_BASE_URL", "http://example.com")
    monkeypatch.setenv("MODEL_NAME", "m")
    get_settings.cache_clear()
    gw = build_model_gateway()
    assert isinstance(gw, OpenAICompatibleGateway)
    assert gw.api_key == "k"


def test_factory_replicate(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "replicate")
    monkeypatch.setenv("MODEL_API_KEY", "rk")
    monkeypatch.setenv("MODEL_NAME", "owner/model")
    get_settings.cache_clear()
    gw = build_model_gateway()
    assert isinstance(gw, ReplicateGateway)


def test_factory_fal(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "fal")
    monkeypatch.setenv("FAL_API_KEY", "fk")
    monkeypatch.setenv("FAL_MODEL", "fal-ai/x")
    get_settings.cache_clear()
    gw = build_model_gateway()
    assert isinstance(gw, FalGateway)
    assert gw.api_key == "fk"


def test_openai_gateway_http(monkeypatch):
    # monkeypatch urllib to avoid network
    import app.gateways as g

    def fake_http_json(url, method="POST", headers=None, body=None, timeout=120):
        return {"data": [{"url": "http://example.com/out.mp4"}]}

    def fake_download(url, dest, timeout=300):
        import pathlib
        pathlib.Path(dest).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(dest).write_bytes(b"video")
        return dest

    monkeypatch.setattr(g, "_http_json", fake_http_json)
    monkeypatch.setattr(g, "_download", fake_download)
    gw = OpenAICompatibleGateway(api_key="k", base_url="http://example.com", model="m")
    res = gw.generate(g.GenerationRequest(prompt="hi"))
    assert res.output_path.endswith(".mp4")
    assert os.path.exists(res.output_path)
