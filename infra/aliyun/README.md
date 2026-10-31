# Aliyun OSS + CDN deployment guide

Domestic (mainland China) media delivery for the AI video platform:

```
worker / api  ──upload──▶  OSS bucket (private, cn-shanghai)
                                   │  private-bucket back-to-origin
                                   ▼
                           Aliyun CDN  ──signed URL──▶  browser / player
```

All media is stored privately in OSS. Public playback always goes through the
CDN using URL authentication type A, so links expire and cannot be hot-linked.

## 1. Prerequisites

- An Aliyun account with real-name verification (企业实名认证 recommended).
- A domain whose **ICP filing (ICP备案) is approved** and whose registrant
  matches the Aliyun account subject. CDN accelerated domains in mainland China
  cannot be enabled before the filing is approved — see
  [`../compliance/icp-filing-checklist.md`](../compliance/icp-filing-checklist.md).
- A RAM user (never the root account) for Terraform and workloads.
- Optional: an SSL certificate for `cdn.example.com` (uploaded to Aliyun SSL
  Certificates Service or issued by it).

## 2. Naming and regions

| Resource | Example | Notes |
| --- | --- | --- |
| OSS bucket | `aivideo-prod-cn` | Globally unique, lowercase, private ACL |
| OSS region | `cn-shanghai` | Same region as the ECS/ACK cluster for free internal traffic |
| CDN domain | `cdn.example.com` | Must be ICP-filed; CNAME to the CDN endpoint |
| App domain | `app.example.com` | ICP-filed; served by nginx/Ingress |
| API domain | `api.example.com` | ICP-filed; served by nginx/Ingress |

Use the **internal** OSS endpoint (`oss-cn-shanghai-internal.aliyuncs.com`) from
workloads inside Aliyun so uploads do not consume public bandwidth.

## 3. RAM user and least-privilege policy

Create a RAM user `aivideo-storage` with programmatic access only, then attach a
custom policy limited to the bucket and CDN domain. Template:
[`oss-cdn-policy.json`](./oss-cdn-policy.json). Replace:

- `<ACCOUNT_ID>` with the 16-digit Aliyun account ID,
- `<BUCKET>` / `<CDN_DOMAIN>` with real values.

For production prefer **STS tokens** (`ALIYUN_OSS_STS_TOKEN`) issued by a role
instead of long-lived AccessKeys. Both the API and the worker accept the STS
token env var.

## 4. OSS bucket configuration

Terraform in [`../terraform/aliyun`](../terraform/aliyun) creates the bucket and
CDN domain. If configuring by console:

1. **Bucket** — private ACL, region `cn-shanghai`, server-side encryption
   AES-256, versioning on.
2. **CORS** — allow `https://app.example.com` with `GET, HEAD, PUT, POST`,
   headers `*`, expose `ETag`, `x-oss-request-id`, max age 600s. Needed only for
   browser-direct uploads; server-side uploads do not need CORS.
3. **Lifecycle** — transition `videos/*/raw/*` to Infrequent Access after 30
   days, expire temporary `tmp/` objects after 7 days. Never expire
   `videos/*/final.mp4` or HLS segments automatically without a retention policy.
4. **Logging** — write access logs to `aivideo-logs` bucket.
5. **Hotlink protection** — rely on CDN URL auth and referer allow-list; do not
   make the bucket public as a shortcut.
6. **Back-to-origin** — CDN pulls from the private bucket using the CDN service
   role. Enable "private bucket origin" for the accelerated domain and confirm
   the CDN service-linked role exists.

## 5. CDN domain configuration

| Setting | Value |
| --- | --- |
| Accelerated domain | `cdn.example.com` |
| Business type | 视频点播 (VOD) |
| Origin | OSS bucket `aivideo-prod-cn` (private bucket origin) |
| Range request | Enabled (required for video seeking) |
| HTTPS | Enabled, TLS 1.2+, HTTP/2, force HTTPS |
| URL auth | Type A, keys `auth_key1` / `auth_key2` (rotate both) |
| m3u8 auth | **On** — lets CDN authenticate `.ts` segment requests with the playlist signature; otherwise relative HLS segments return 403 |
| Referer | Allow `app.example.com`, deny empty referer for playback |
| Cache | See table below |
| Ignore query string | Off — signed URLs must not be collapsed |

Recommended cache rules:

| Path | TTL | Reason |
| --- | --- | --- |
| `/videos/*/hls/*.m3u8` | 10s | Playlist changes during transcoding |
| `/videos/*/hls/*.ts` | 30 days | Immutable segments |
| `/videos/*/final.mp4` | 7 days | Immutable output |
| `/videos/*/thumb.jpg` | 7 days | Immutable thumbnail |
| default | 1 hour | Safer default |

Because object keys include the task id (`videos/<task_id>/...`), caching does
not need invalidation on overwrite; a retried task must use a fresh key.

## 6. Application environment

| Variable | Example | Secret? |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `aliyun` | no |
| `ALIYUN_OSS_BUCKET` | `aivideo-prod-cn` | no |
| `ALIYUN_OSS_REGION` | `cn-shanghai` | no |
| `ALIYUN_OSS_ENDPOINT` | `https://oss-cn-shanghai-internal.aliyuncs.com` | no |
| `ALIYUN_OSS_USE_INTERNAL` | `true` | no |
| `ALIYUN_OSS_ACCESS_KEY_ID` | RAM user key | **yes** |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | RAM user secret | **yes** |
| `ALIYUN_OSS_STS_TOKEN` | STS token (preferred) | **yes** |
| `ALIYUN_OSS_PUBLIC_BASE_URL` | `https://cdn.example.com` (fallback) | no |
| `CDN_DOMAIN` | `https://cdn.example.com` | no |
| `CDN_AUTH_KEY` | type-A private key | **yes** |
| `CDN_URL_TTL_SECONDS` | `3600` | no |

The API (`apps/api/src/storage/oss-storage.service.ts`) and the worker
(`services/worker/app/storage/aliyun_oss.py`) both implement the same contract:
upload by key, return a CDN-signed URL, and fall back to stub `oss://` URLs when
credentials are absent. The signing utilities are
`apps/api/src/storage/cdn-url.ts` (TypeScript) and
`services/worker/app/storage/cdn_url.py` (Python).

Deployment assets:

- Terraform: [`../terraform/aliyun`](../terraform/aliyun)
- Helm values: [`../helm/ai-video-platform`](../helm/ai-video-platform) (see
  `values.aliyun.example.yaml`)
- Origin nginx (app/API TLS): [`../nginx`](../nginx)

## 7. Verification

```bash
# 1. Upload a test object through the worker adapter (stub-safe).
python3 - <<'PY'
from app.storage.aliyun_oss import AliyunOSSStorage
s = AliyunOSSStorage()
print(s.upload_bytes(b"ok", "tmp/healthcheck.txt", "text/plain"))
print(s.build_url("tmp/healthcheck.txt"))
PY

# 2. Check the signed URL is rejected after expiry (should return 403).
curl -sI "https://cdn.example.com/tmp/healthcheck.txt?auth_key=<expired>"

# 3. Check a fresh signed URL plays with range requests.
curl -sI -H "Range: bytes=0-1023" "https://cdn.example.com/videos/<task>/final.mp4?auth_key=<fresh>"
```

Expected: `206 Partial Content`, `Content-Range`, and no `x-oss-*` errors. A
`403` on a fresh URL usually means the signature path or the auth key is wrong;
a `502` means private-bucket back-to-origin permission is missing.

## 8. Cost and operations notes

- CDN egress dominates cost; keep HLS segments cached for 30 days and avoid
  cache-busting query parameters.
- Signed URLs use the path only, so adding `?quality=hd` does not break them.
- Rotate `CDN_AUTH_KEY` and the RAM secret with a dual-key window: add key 2,
  deploy, wait for TTL, then remove key 1.
- Enable CDN real-time logs and OSS access logs to the analytics bucket for
  abuse detection.
- Domestic CDN requires ICP filing; Hong Kong/overseas acceleration does not but
  has higher latency for mainland users and different compliance obligations.
