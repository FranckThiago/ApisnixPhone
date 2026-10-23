import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRecordingsSource } from '../src/recordings/client';
import { configureEmbeddedSession, clearEmbeddedSession, openEmbeddedSession, sessionFetch } from '../src/http/embeddedSession';

const secret = 'a'.repeat(43);
beforeEach(() => { vi.stubGlobal('location', { origin: 'https://phone.example' }); configureEmbeddedSession('https://crm.example'); });
afterEach(() => { clearEmbeddedSession(); vi.unstubAllGlobals(); });

describe('embedded HTTP transport', () => {
  it('keeps credentials only in memory and omits third-party cookies', async () => {
    const fetcher = vi.fn(async () => Response.json({ token: secret, expiresAt: Date.now() + 60000 })); vi.stubGlobal('fetch', fetcher);
    await openEmbeddedSession('/api', 'fiction', 'fiction-password');
    expect(fetcher.mock.calls[0]).toHaveLength(2);
    await sessionFetch('/api/me', { credentials: 'include', headers: { Authorization: 'malicious override', 'X-CSRF-Token': 'csrf' } });
    const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[1]![1];
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${secret}`);
    expect(new Headers(init.headers).get('X-Apisnix-Embed-Origin')).toBe('https://crm.example');
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('csrf');
    clearEmbeddedSession(); await sessionFetch('/api/me');
    expect(new Headers((fetcher.mock.calls as unknown as [string, RequestInit][])[2]![1].headers).has('Authorization')).toBe(false);
  });
  it('refuses all off-origin and static destinations before fetch', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const url of ['https://evil.example/api/me', '//evil.example/api/me', '/index.html', '/api/../private']) await expect(sessionFetch(url)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not resurrect a session after logout during login', async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const attempt = openEmbeddedSession('/api', 'fiction', 'fiction-password'); clearEmbeddedSession();
    finish(Response.json({ token: secret, expiresAt: Date.now() + 60000 }));
    await expect(attempt).rejects.toThrow('Session superseded');
  });
  it('refuses malformed or expired tokens', async () => {
    for (const token of ['', 'short', secret]) {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ token, expiresAt: 1 })));
      await expect(openEmbeddedSession('/api', 'fiction', 'fiction-password')).rejects.toThrow();
    }
  });
});

it('loads embedded audio through the authorized transport before creating a blob URL', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).includes('/audio')
    ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } })
    : Response.json({ token: secret, expiresAt: Date.now() + 60000 }));
  vi.stubGlobal('fetch', fetcher);
  await openEmbeddedSession('/api', 'fiction', 'fiction-password');
  const blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-audio');
  try {
    expect(await new HttpRecordingsSource('/api').audioUrl('own:file', false)).toBe('blob:test-audio');
    const call = (fetcher.mock.calls as unknown as [string, RequestInit][])[1]!;
    expect(call[0]).toContain('/api/recordings/own%3Afile/audio');
    expect(new Headers(call[1].headers).get('Authorization')).toBe(`Bearer ${secret}`);
    expect(call[1].credentials).toBe('omit');
    expect(blobUrl).toHaveBeenCalledWith(expect.any(Blob));
  } finally { blobUrl.mockRestore(); }
});
