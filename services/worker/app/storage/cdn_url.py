"""Aliyun CDN URL signing helpers (URL authentication type A).

Aliyun CDN supports several URL auth schemes. Type A (the default) is:

    sign = md5("<uri>-<timestamp>-<rand>-<uid>-<private_key>")
    url  = "<scheme>://<domain><uri>?auth_key=<timestamp>-<rand>-<uid>-<sign>"

``uri`` is the request path only (query string excluded), e.g.
``/videos/t1/final.mp4``. The signature is computed over the path, so the
same signed URL stays valid when extra query parameters are appended.

Docs: https://help.aliyun.com/document_detail/85139.html
"""

from __future__ import annotations

import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


@dataclass(frozen=True)
class SignedCdnUrl:
    """A signed CDN URL plus the metadata used to build it."""

    url: str
    expires_at: int
    timestamp: int
    signature: str


def _new_rand() -> str:
    """Return a short random component; Aliyun accepts an arbitrary string."""
    return str(secrets.randbelow(100_000))


def sign_cdn_url(
    url: str,
    auth_key: str,
    expires_in_seconds: int = 3600,
    uid: str = "0",
    now: Optional[int] = None,
    rand: Optional[str] = None,
) -> SignedCdnUrl:
    """Sign a CDN URL with Aliyun type-A authentication.

    Args:
        url: Absolute URL (``https://cdn.example.com/videos/a.mp4``) or the
            origin path (``/videos/a.mp4``) when the caller prepends the host.
        auth_key: CDN auth key (``CDN_AUTH_KEY`` / ``auth_key1`` in Terraform).
        expires_in_seconds: Validity window; Aliyun requires a future expiry.
        uid: Optional end-user identifier for per-user URLs.
        now: Override for the current unix timestamp (tests).
        rand: Override for the random component (tests).

    Raises:
        ValueError: if the URL is empty, the key is missing, or the expiry is
            not in the future.
    """
    if not url:
        raise ValueError("url is required to sign a CDN URL")
    if not auth_key:
        raise ValueError("auth_key is required to sign a CDN URL")
    if expires_in_seconds <= 0:
        raise ValueError("expires_in_seconds must be positive")

    timestamp = int(now if now is not None else time.time())
    expires_at = timestamp + int(expires_in_seconds)
    rand_value = rand if rand is not None else _new_rand()
    uid_value = uid or "0"

    parts = urlsplit(url)
    uri = parts.path or "/"
    sstring = f"{uri}-{expires_at}-{rand_value}-{uid_value}-{auth_key}"
    signature = hashlib.md5(sstring.encode("utf-8")).hexdigest()

    query = parse_qsl(parts.query, keep_blank_values=True)
    query.append(("auth_key", f"{expires_at}-{rand_value}-{uid_value}-{signature}"))
    signed = urlunsplit((parts.scheme, parts.netloc, uri, urlencode(query), parts.fragment))

    return SignedCdnUrl(
        url=signed,
        expires_at=expires_at,
        timestamp=timestamp,
        signature=signature,
    )


def build_cdn_url(
    key: str,
    base_url: str,
    auth_key: str = "",
    expires_in_seconds: int = 3600,
    uid: str = "0",
    now: Optional[int] = None,
) -> str:
    """Join an object key to the CDN base URL and optionally sign it.

    ``key`` may contain leading slashes; they are normalised to a single one.
    When ``auth_key`` is empty the URL is returned unsigned (useful for public
    buckets or local development).
    """
    if not base_url:
        raise ValueError("base_url is required to build a CDN URL")
    host = base_url.rstrip("/")
    path = "/" + key.lstrip("/")
    url = f"{host}{path}"
    if not auth_key:
        return url
    return sign_cdn_url(url, auth_key, expires_in_seconds=expires_in_seconds, uid=uid, now=now).url
