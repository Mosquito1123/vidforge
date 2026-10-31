import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { signCdnUrl } from './cdn-url.js';
export interface StorageUploadResult {
  bucket: string;
  key: string;
  url: string;
}

export interface CdnSignedUrl {
  url: string;
  expiresAt: number;
}

/**
 * Minimal surface of the `ali-oss` client used here. The SDK is imported
 * dynamically so the app (and tests) run without it installed, and so stub mode
 * never touches the network.
 */
interface OssClientLike {
  put(key: string, body: string | Buffer, options?: Record<string, unknown>): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  signatureUrl?(key: string, options?: Record<string, unknown>): string;
}

/**
 * Aliyun OSS storage adapter (env-driven, stub when unconfigured).
 *
 * Env:
 *   ALIYUN_OSS_BUCKET, ALIYUN_OSS_REGION, ALIYUN_OSS_ENDPOINT,
 *   ALIYUN_OSS_ACCESS_KEY_ID, ALIYUN_OSS_ACCESS_KEY_SECRET,
 *   ALIYUN_OSS_STS_TOKEN, ALIYUN_OSS_PUBLIC_BASE_URL,
 *   CDN_DOMAIN, CDN_AUTH_KEY, CDN_URL_TTL_SECONDS
 *
 * Credentials fall back to ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET so a
 * single RAM user can serve both OSS and content moderation.
 */
@Injectable()
export class OssStorageService {
  private readonly logger = new Logger(OssStorageService.name);
  private readonly bucketName = process.env.ALIYUN_OSS_BUCKET ?? '';
  private readonly region = process.env.ALIYUN_OSS_REGION ?? 'cn-shanghai';
  private readonly endpoint = process.env.ALIYUN_OSS_ENDPOINT ?? '';
  private readonly accessKeyId =
    process.env.ALIYUN_OSS_ACCESS_KEY_ID ?? process.env.ALIYUN_ACCESS_KEY_ID ?? '';
  private readonly accessKeySecret =
    process.env.ALIYUN_OSS_ACCESS_KEY_SECRET ??
    process.env.ALIYUN_ACCESS_KEY_SECRET ??
    '';
  private readonly stsToken = process.env.ALIYUN_OSS_STS_TOKEN ?? '';
  private readonly publicBaseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL ?? '';
  private readonly cdnDomain = process.env.CDN_DOMAIN ?? '';
  private readonly cdnAuthKey = process.env.CDN_AUTH_KEY ?? '';
  private readonly cdnTtlSeconds = Number(process.env.CDN_URL_TTL_SECONDS ?? 3600) || 3600;

  private clientInstance: OssClientLike | null = null;

  get bucket(): string {
    return this.bucketName || 'local-bucket';
  }

  get resolvedEndpoint(): string {
    if (this.endpoint) return this.endpoint;
    return `https://${this.bucketName}.oss-${this.region}.aliyuncs.com`;
  }

  isCdnEnabled(): boolean {
    return Boolean(this.cdnDomain);
  }

  isConfigured(): boolean {
    return Boolean(this.bucketName && this.accessKeyId && this.accessKeySecret);
  }

  /** Public (or CDN-signed) URL for an object key. */
  buildUrl(key: string, expiresInSeconds = this.cdnTtlSeconds): string {
    const url = this.unsignedUrl(key);
    if (!this.cdnAuthKey || !this.cdnDomain) return url;
    return signCdnUrl({ url, authKey: this.cdnAuthKey, expiresInSeconds }).url;
  }

  private unsignedUrl(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    const rawBase = this.cdnDomain || this.publicBaseUrl;
    if (rawBase) {
      const base = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
      return `${base.replace(/\/+$/, '')}/${normalized}`;
    }
    if (this.bucketName) {
      return `https://${this.bucketName}.oss-${this.region}.aliyuncs.com/${normalized}`;
    }
    return `oss://${this.bucket}/${normalized}`;
  }

  /**
   * Sign a CDN URL for an object key. Returns an unsigned URL when no CDN auth
   * key is configured, so callers can treat the result uniformly.
   */
  signUrl(key: string, expiresInSeconds = this.cdnTtlSeconds): CdnSignedUrl {
    if (!this.cdnAuthKey || !this.cdnDomain) {
      return { url: this.unsignedUrl(key), expiresAt: 0 };
    }
    const signed = signCdnUrl({
      url: this.unsignedUrl(key),
      authKey: this.cdnAuthKey,
      expiresInSeconds,
    });
    return { url: signed.url, expiresAt: signed.expiresAt };
  }

  async uploadFile(
    localPath: string,
    key: string,
    contentType?: string,
  ): Promise<StorageUploadResult> {
    const data = await readFile(localPath);
    return this.uploadBytes(data, key, contentType);
  }

  async uploadBytes(
    data: Buffer,
    key: string,
    contentType?: string,
  ): Promise<StorageUploadResult> {
    const normalized = key.replace(/^\/+/, '');
    if (!this.isConfigured()) {
      this.logger.warn(`Aliyun OSS not configured; returning stub URL for ${normalized}`);
      return { bucket: this.bucket, key: normalized, url: this.buildUrl(normalized) };
    }

    const client = await this.getClient();
    await client.put(normalized, data, {
      headers: contentType ? { 'Content-Type': contentType } : undefined,
      mime: contentType,
    });
    return { bucket: this.bucket, key: normalized, url: this.buildUrl(normalized) };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`Aliyun OSS not configured; skipping delete for ${key}`);
      return;
    }
    const client = await this.getClient();
    await client.delete(key.replace(/^\/+/, ''));
  }

  /** Direct OSS signed URL (bypasses CDN); useful for uploads or private reads. */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.isConfigured()) {
      return this.buildUrl(key, expiresInSeconds);
    }
    const client = await this.getClient();
    if (typeof client.signatureUrl === 'function') {
      return client.signatureUrl(key.replace(/^\/+/, ''), { expires: expiresInSeconds });
    }
    return this.buildUrl(key, expiresInSeconds);
  }

  private async getClient(): Promise<OssClientLike> {
    if (this.clientInstance) return this.clientInstance;
    if (!this.isConfigured()) {
      throw new Error(
        'Aliyun OSS is not configured: set ALIYUN_OSS_BUCKET, ALIYUN_OSS_ACCESS_KEY_ID and ALIYUN_OSS_ACCESS_KEY_SECRET',
      );
    }

    let OSS: new (options: Record<string, unknown>) => OssClientLike;
    try {
      const mod = (await import('ali-oss')) as unknown as {
        default?: new (options: Record<string, unknown>) => OssClientLike;
      } & (new (options: Record<string, unknown>) => OssClientLike);
      OSS = mod.default ?? mod;
    } catch {
      throw new Error('ali-oss is required for Aliyun OSS uploads (pnpm add ali-oss)');
    }

    this.clientInstance = new OSS({
      region: this.region,
      bucket: this.bucketName,
      endpoint: this.endpoint || undefined,
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      stsToken: this.stsToken || undefined,
      secure: true,
    });
    return this.clientInstance;
  }
}
