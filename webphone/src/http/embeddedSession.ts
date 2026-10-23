/** The parent never receives this token. No cookies, URL credentials or browser storage. */
let parentOrigin: string | null = null;
let token: string | null = null;
let generation = 0;
export function configureEmbeddedSession(origin: string) { parentOrigin = origin; clearEmbeddedSession(); }
export function isEmbeddedSession() { return parentOrigin !== null; }
export function clearEmbeddedSession() { token = null; generation++; }

export async function openEmbeddedSession(base: string, username: string, password: string) {
  clearEmbeddedSession();
  const current = generation;
  const response = await sessionFetch(base + '/embed-session', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) return response;
  const value = await response.clone().json() as { token?: unknown; expiresAt?: unknown };
  if (typeof value.token !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(value.token)
      || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new Error('Invalid embedded session');
  if (current !== generation) throw new Error('Session superseded');
  token = value.token;
  return response;
}

export const sessionFetch: typeof fetch = (input, init) => {
  if (!parentOrigin) return fetch(input, init);
  // Never forward the bearer to another origin, a static file or a redirect.
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return Promise.reject(new Error('Invalid embedded API destination'));
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('X-Apisnix-Embed-Origin', parentOrigin);
  headers.delete('Authorization');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: 'omit', redirect: 'error', cache: 'no-store' });
};
