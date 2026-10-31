import { createHash, randomInt } from 'node:crypto';

/**
 * Aliyun CDN URL signing (URL authentication type A).
 *
 *   sign = md5("<uri>-<expiresAt>-<rand>-<uid>-<authKey>")
 *   url  = "<url>?auth_key=<expiresAt>-<rand>-<uid>-<sign>"
 *
 * `uri` is the request path only (the signature ignores host and query), which
 * matches Aliyun's reference implementation:
 * https://help.aliyun.com/document_detail/85139.html
 */

export interface SignCdnUrlOptions {
  /** Absolute CDN URL, e.g. https://cdn.example.com/videos/a.mp4 */
  url: string;
  /** CDN auth key (Terraform `auth_key1` / CDN_AUTH_KEY). */
  authKey: string;
  /** Validity window in seconds. Defaults to 3600. */
  expiresInSeconds?: number;
  /** Optional end-user identifier for per-user URLs. Defaults to "0". */
  uid?: string;
  /** Unix timestamp in seconds; override for deterministic tests. */
  now?: number;
  /** Random component; override for deterministic tests. */
  rand?: string;
}

export interface SignedCdnUrl {
  url: string;
  expiresAt: number;
  timestamp: number;
  signature: string;
}

export function signCdnUrl(options: SignCdnUrlOptions): SignedCdnUrl {
  const {
    url,
    authKey,
    expiresInSeconds = 3600,
    uid = '0',
    now = Math.floor(Date.now() / 1000),
    rand = String(randomInt(0, 100_000)),
  } = options;

  if (!url) throw new Error('url is required to sign a CDN URL');
  if (!authKey) throw new Error('authKey is required to sign a CDN URL');
  if (expiresInSeconds <= 0) throw new Error('expiresInSeconds must be positive');

  const parsed = new URL(url);
  const uri = parsed.pathname || '/';
  const expiresAt = Math.floor(now) + Math.floor(expiresInSeconds);
  const signature = createHash('md5')
    .update(`${uri}-${expiresAt}-${rand}-${uid}-${authKey}`)
    .digest('hex');

  parsed.searchParams.append('auth_key', `${expiresAt}-${rand}-${uid}-${signature}`);

  return { url: parsed.toString(), expiresAt, timestamp: Math.floor(now), signature };
}

/**
 * Join an object key to a CDN base URL and optionally sign it.
 * With no auth key the URL is returned unsigned (public bucket / local dev).
 */
export function buildCdnUrl(
  key: string,
  baseUrl: string,
  authKey = '',
  expiresInSeconds = 3600,
  uid = '0',
): string {
  if (!baseUrl) throw new Error('baseUrl is required to build a CDN URL');
  const normalized = key.replace(/^\/+/, '');
  const url = `${baseUrl.replace(/\/+$/, '')}/${normalized}`;
  if (!authKey) return url;
  return signCdnUrl({ url, authKey, expiresInSeconds, uid }).url;
}
