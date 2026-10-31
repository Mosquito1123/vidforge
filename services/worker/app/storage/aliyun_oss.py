"""Aliyun OSS storage adapter (stub-friendly).

Mirrors :class:`app.storage.s3.S3Storage` so the task processor can switch
providers through ``STORAGE_PROVIDER`` without code changes.

Behaviour:

* When ``ALIYUN_OSS_BUCKET`` (or OSS credentials) is missing the adapter runs
  in stub mode and returns deterministic ``oss://`` URLs without network calls.
* When configured it uses ``oss2`` (imported lazily so unit tests do not need
  the SDK installed) and returns a signed CDN URL when ``CDN_DOMAIN`` and
  ``CDN_AUTH_KEY`` are set, otherwise a public OSS URL.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

from app.config import Settings, get_settings
from app.storage.cdn_url import build_cdn_url

logger = logging.getLogger(__name__)


@dataclass
class UploadResult:
    bucket: str
    key: str
    url: str


DEFAULT_REGION = "cn-shanghai"


class AliyunOSSStorage:
    provider = "aliyun"

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------ config
    @property
    def bucket_name(self) -> str:
        return self.settings.aliyun_oss_bucket or "local-bucket"

    @property
    def access_key_id(self) -> str:
        return self.settings.aliyun_oss_access_key_id or self.settings.aliyun_access_key_id

    @property
    def access_key_secret(self) -> str:
        return self.settings.aliyun_oss_access_key_secret or self.settings.aliyun_access_key_secret

    @property
    def endpoint(self) -> str:
        explicit = self.settings.aliyun_oss_endpoint
        if explicit:
            return explicit
        region = self.settings.aliyun_oss_region or DEFAULT_REGION
        suffix = "-internal" if self.settings.aliyun_oss_use_internal else ""
        return f"https://oss-{region}{suffix}.aliyuncs.com"

    @property
    def is_configured(self) -> bool:
        """True when a bucket plus credentials are present."""
        return bool(
            self.settings.aliyun_oss_bucket
            and self.access_key_id
            and self.access_key_secret
        )

    # ------------------------------------------------------------------- SDK
    def _bucket(self):
        """Create an ``oss2.Bucket`` lazily (keeps oss2 optional)."""
        if not self.is_configured:
            raise RuntimeError(
                "Aliyun OSS is not configured: set ALIYUN_OSS_BUCKET, "
                "ALIYUN_OSS_ACCESS_KEY_ID and ALIYUN_OSS_ACCESS_KEY_SECRET"
            )
        try:
            import oss2  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise RuntimeError(
                "oss2 is required for Aliyun OSS uploads (pip install oss2)"
            ) from exc

        auth = oss2.Auth(self.access_key_id, self.access_key_secret)
        if self.settings.aliyun_oss_sts_token:
            auth = oss2.StsAuth(
                self.access_key_id,
                self.access_key_secret,
                self.settings.aliyun_oss_sts_token,
            )
        return oss2.Bucket(auth, self.endpoint, self.settings.aliyun_oss_bucket)

    # ------------------------------------------------------------------- URLs
    def build_url(self, key: str, expires_in_seconds: Optional[int] = None) -> str:
        """Return the public URL for an object (signed when CDN auth is on)."""
        ttl = expires_in_seconds or self.settings.cdn_url_ttl_seconds
        base = self.settings.cdn_domain or self.settings.aliyun_oss_public_base_url
        if base:
            if "://" not in base:
                base = f"https://{base}"
            return build_cdn_url(
                key,
                base,
                auth_key=self.settings.cdn_auth_key,
                expires_in_seconds=ttl,
            )

        region = self.settings.aliyun_oss_region or DEFAULT_REGION
        if self.settings.aliyun_oss_bucket:
            return f"https://{self.settings.aliyun_oss_bucket}.oss-{region}.aliyuncs.com/{key.lstrip('/')}"
        return f"oss://{self.bucket_name}/{key.lstrip('/')}"

    def presign_get(self, key: str, expires_in_seconds: int = 3600) -> str:
        """Presigned OSS GET URL (used when the CDN is not configured)."""
        if not self.is_configured:
            return self.build_url(key, expires_in_seconds)
        return self._bucket().sign_url("GET", key, expires_in_seconds)

    # ---------------------------------------------------------------- uploads
    def upload_file(
        self,
        local_path: str,
        key: str,
        content_type: Optional[str] = None,
    ) -> UploadResult:
        """Upload a local file to OSS. Stubbed when credentials are absent."""
        key = key.lstrip("/")
        if not self.is_configured:
            logger.warning(
                "Aliyun OSS not configured; returning stub URL for %s", key
            )
            url = self.build_url(key)
            return UploadResult(bucket=self.bucket_name, key=key, url=url)

        bucket = self._bucket()
        headers = {"Content-Type": content_type} if content_type else None
        bucket.put_object_from_file(key, local_path, headers=headers)
        return UploadResult(bucket=self.bucket_name, key=key, url=self.build_url(key))

    def upload_bytes(
        self,
        data: bytes,
        key: str,
        content_type: Optional[str] = None,
    ) -> UploadResult:
        """Upload in-memory bytes to OSS. Stubbed when credentials are absent."""
        key = key.lstrip("/")
        if not self.is_configured:
            logger.warning(
                "Aliyun OSS not configured; returning stub URL for %s", key
            )
            url = self.build_url(key)
            return UploadResult(bucket=self.bucket_name, key=key, url=url)

        headers = {"Content-Type": content_type} if content_type else None
        self._bucket().put_object(key, data, headers=headers)
        return UploadResult(bucket=self.bucket_name, key=key, url=self.build_url(key))

    def upload_directory(
        self,
        local_dir: str,
        key_prefix: str,
        content_types: Optional[dict[str, str]] = None,
    ) -> list[UploadResult]:
        """Upload every file under ``local_dir``, preserving relative paths."""
        types = content_types or {}
        results: list[UploadResult] = []
        for root, _dirs, files in os.walk(local_dir):
            for name in files:
                local = os.path.join(root, name)
                rel = os.path.relpath(local, local_dir).replace(os.sep, "/")
                key = f"{key_prefix.rstrip('/')}/{rel}"
                results.append(
                    self.upload_file(local, key, content_type=types.get(name))
                )
        return results

    def delete_object(self, key: str) -> None:
        """Delete one object; no-op in stub mode."""
        if not self.is_configured:
            logger.warning("Aliyun OSS not configured; skipping delete for %s", key)
            return
        self._bucket().delete_object(key.lstrip("/"))
