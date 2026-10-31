"""S3 / object-storage upload helpers (stubs)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings


@dataclass
class UploadResult:
    bucket: str
    key: str
    url: str


class S3Storage:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _local_url(self, local_path: str) -> str:
        """Public URL for a file kept on the local disk (dev / preview mode)."""
        media_dir = os.path.abspath(self.settings.media_dir)
        absolute = os.path.abspath(local_path)
        try:
            relative = os.path.relpath(absolute, media_dir).replace(os.sep, "/")
        except ValueError:
            relative = os.path.basename(absolute)
        if relative.startswith(".."):
            relative = os.path.basename(absolute)
        return f"{self.settings.media_base_url.rstrip('/')}/files/{relative}"

    def _client(self):
        # Lazy import so the module imports without boto3 installed in tests.
        import boto3

        kwargs = {"region_name": self.settings.s3_region}
        if self.settings.s3_endpoint_url:
            kwargs["endpoint_url"] = self.settings.s3_endpoint_url
        if self.settings.aws_access_key_id and self.settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = self.settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = self.settings.aws_secret_access_key
        return boto3.client("s3", **kwargs)

    def upload_file(self, local_path: str, key: str, content_type: Optional[str] = None) -> UploadResult:
        """Upload a local file to S3. Stubbed: returns a deterministic URL without network calls when unconfigured."""
        settings = self.settings
        bucket = settings.s3_bucket or "local-bucket"
        if not settings.s3_bucket:
            # Stub mode: no real upload. Files stay on disk and are served by the
            # worker's `/files` static mount so browsers can play them.
            url = self._local_url(local_path)
            return UploadResult(bucket=bucket, key=key, url=url)

        client = self._client()
        extra = {"ContentType": content_type} if content_type else {}
        client.upload_file(local_path, bucket, key, ExtraArgs=extra or None)
        region = settings.s3_region
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        if settings.s3_endpoint_url:
            url = f"{settings.s3_endpoint_url.rstrip('/')}/{bucket}/{key}"
        return UploadResult(bucket=bucket, key=key, url=url)

    def upload_bytes(self, data: bytes, key: str, content_type: Optional[str] = None) -> UploadResult:
        settings = self.settings
        bucket = settings.s3_bucket or "local-bucket"
        if not settings.s3_bucket:
            return UploadResult(bucket=bucket, key=key, url=f"memory://{key}")
        client = self._client()
        extra = {"ContentType": content_type} if content_type else {}
        client.put_object(Bucket=bucket, Key=key, Body=data, **extra)
        region = settings.s3_region
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        return UploadResult(bucket=bucket, key=key, url=url)