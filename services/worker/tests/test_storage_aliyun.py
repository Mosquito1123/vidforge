"""Tests for the Aliyun OSS adapter and CDN URL signing (no network needed)."""

import pytest

from app.config import get_settings
from app.storage import build_storage
from app.storage.aliyun_oss import AliyunOSSStorage
from app.storage.cdn_url import build_cdn_url, sign_cdn_url
from app.storage.s3 import S3Storage

FIXED_NOW = 1_700_000_000
FIXED_RAND = "1234"


def test_sign_cdn_url_type_a_matches_reference_vector():
    signed = sign_cdn_url(
        "https://cdn.example.com/videos/t1/final.mp4",
        auth_key="test-key",
        expires_in_seconds=3600,
        uid="0",
        now=FIXED_NOW,
        rand=FIXED_RAND,
    )
    # md5("/videos/t1/final.mp4-1700003600-1234-0-test-key")
    assert signed.expires_at == FIXED_NOW + 3600
    assert signed.signature == "bb495674fcafd936e36d7c2eafed4171"
    assert signed.url == (
        "https://cdn.example.com/videos/t1/final.mp4"
        "?auth_key=1700003600-1234-0-bb495674fcafd936e36d7c2eafed4171"
    )


def test_sign_cdn_url_keeps_existing_query_parameters():
    signed = sign_cdn_url(
        "https://cdn.example.com/videos/a.mp4?x=1",
        auth_key="k",
        now=FIXED_NOW,
        rand=FIXED_RAND,
    )
    assert "x=1" in signed.url
    assert "auth_key=" in signed.url


def test_sign_cdn_url_rejects_missing_input():
    with pytest.raises(ValueError):
        sign_cdn_url("", auth_key="k")
    with pytest.raises(ValueError):
        sign_cdn_url("https://cdn.example.com/a.mp4", auth_key="")
    with pytest.raises(ValueError):
        sign_cdn_url("https://cdn.example.com/a.mp4", auth_key="k", expires_in_seconds=0)


def test_build_cdn_url_without_auth_key_is_unsigned():
    assert (
        build_cdn_url("/videos/a.mp4", "https://cdn.example.com/")
        == "https://cdn.example.com/videos/a.mp4"
    )


def test_oss_adapter_stub_returns_oss_uri(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "aliyun")
    monkeypatch.delenv("ALIYUN_OSS_BUCKET", raising=False)
    monkeypatch.delenv("ALIYUN_OSS_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("ALIYUN_OSS_ACCESS_KEY_SECRET", raising=False)
    monkeypatch.delenv("ALIYUN_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("ALIYUN_ACCESS_KEY_SECRET", raising=False)
    monkeypatch.delenv("CDN_DOMAIN", raising=False)
    get_settings.cache_clear()

    storage = build_storage("aliyun")
    assert isinstance(storage, AliyunOSSStorage)
    assert storage.is_configured is False

    result = storage.upload_bytes(b"data", "/videos/t1/final.mp4")
    assert result.key == "videos/t1/final.mp4"
    assert result.url == "oss://local-bucket/videos/t1/final.mp4"


def test_oss_adapter_uses_signed_cdn_url_without_network(monkeypatch):
    monkeypatch.setenv("CDN_DOMAIN", "https://cdn.example.com")
    monkeypatch.setenv("CDN_AUTH_KEY", "test-key")
    monkeypatch.setenv("ALIYUN_OSS_BUCKET", "")
    get_settings.cache_clear()

    storage = AliyunOSSStorage()
    url = storage.build_url("videos/t1/final.mp4", expires_in_seconds=60)
    assert url.startswith("https://cdn.example.com/videos/t1/final.mp4?auth_key=")


def test_factory_defaults_to_s3(monkeypatch):
    monkeypatch.delenv("STORAGE_PROVIDER", raising=False)
    assert isinstance(build_storage(), S3Storage)
