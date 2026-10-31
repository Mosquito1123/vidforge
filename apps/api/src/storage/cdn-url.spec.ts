import { buildCdnUrl, signCdnUrl } from './cdn-url.js';

const FIXED_NOW = 1_700_000_000;

describe('CDN URL signing (Aliyun type A)', () => {
  it('matches the reference vector', () => {
    const signed = signCdnUrl({
      url: 'https://cdn.example.com/videos/t1/final.mp4',
      authKey: 'test-key',
      expiresInSeconds: 3600,
      uid: '0',
      now: FIXED_NOW,
      rand: '1234',
    });

    // md5("/videos/t1/final.mp4-1700003600-1234-0-test-key")
    expect(signed.expiresAt).toBe(FIXED_NOW + 3600);
    expect(signed.signature).toBe('bb495674fcafd936e36d7c2eafed4171');
    expect(signed.url).toBe(
      'https://cdn.example.com/videos/t1/final.mp4?auth_key=1700003600-1234-0-bb495674fcafd936e36d7c2eafed4171',
    );
  });

  it('ignores the host and existing query in the signature', () => {
    const a = signCdnUrl({
      url: 'https://cdn.example.com/videos/a.mp4',
      authKey: 'k',
      now: FIXED_NOW,
      rand: '42',
    });
    const b = signCdnUrl({
      url: 'https://other.example.com/videos/a.mp4?x=1',
      authKey: 'k',
      now: FIXED_NOW,
      rand: '42',
    });

    expect(a.signature).toBe(b.signature);
    expect(b.url).toContain('x=1');
    expect(b.url).toContain('auth_key=');
  });

  it('rejects missing inputs and non-positive expiry', () => {
    expect(() => signCdnUrl({ url: '', authKey: 'k' })).toThrow();
    expect(() =>
      signCdnUrl({ url: 'https://cdn.example.com/a.mp4', authKey: '' }),
    ).toThrow();
    expect(() =>
      signCdnUrl({
        url: 'https://cdn.example.com/a.mp4',
        authKey: 'k',
        expiresInSeconds: 0,
      }),
    ).toThrow();
  });

  it('builds unsigned URLs when no auth key is provided', () => {
    expect(buildCdnUrl('/videos/a.mp4', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/videos/a.mp4',
    );
  });
});
