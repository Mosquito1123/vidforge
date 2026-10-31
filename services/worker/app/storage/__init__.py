"""Object storage adapters and a provider factory.

``STORAGE_PROVIDER`` selects the backend used by the worker:

* ``s3`` (default) - AWS S3 / MinIO via :class:`S3Storage`
* ``aliyun`` / ``oss`` - Aliyun OSS via :class:`AliyunOSSStorage`
"""

from __future__ import annotations

import os
from typing import Union

from app.storage.aliyun_oss import AliyunOSSStorage, UploadResult
from app.storage.s3 import S3Storage

StorageBackend = Union[S3Storage, AliyunOSSStorage]

ALIYUN_ALIASES = {"aliyun", "aliyun_oss", "oss"}


def build_storage(provider: str | None = None) -> StorageBackend:
    """Return the configured storage backend (defaults to S3/MinIO)."""
    selected = (provider or os.getenv("STORAGE_PROVIDER") or "s3").strip().lower()
    if selected in ALIYUN_ALIASES:
        return AliyunOSSStorage()
    return S3Storage()


__all__ = [
    "AliyunOSSStorage",
    "S3Storage",
    "StorageBackend",
    "UploadResult",
    "build_storage",
]
