import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLineLogin } from '../src/features/auth/lineLogin';
import { openLiveWorkspace } from '../src/features/auth/workspace';
import { DemoPhoneController } from '../src/telephony/DemoPhoneController';
import { HttpRecordingsSource } from '../src/recordings/client';
import { DataStore, emptyData } from '../src/storage/DataStore';
import { ServerPersistence } from '../src/storage/serverPersistence';

const credentials = { username: 'test-line', password: 'fiction-only' };
afterEach(() => vi.useRealTimers());

describe('complete line sign-in', () => {
  it('holds one attempt through HTTP loading, trims the identity and permits a later retry', async () => {
    vi.useFakeTimers();
    const phone = new DemoPhoneController();
    const connect = vi.spyOn(phone, 'connect');
    let finish!: () => void;
    const open = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const login = createLineLogin(phone, open);
    const first = login({ ...credentials, username: ' test-line ' });
    expect(login(credentials)).toBe(first);
    await vi.advanceTimersByTimeAsync(1100);
    expect(phone.getSnapshot().connection).toBe('ready');
    expect(login(credentials)).toBe(first);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(credentials, 'demonstration.invalid:test-line');
    finish(); expect(await first).toBe(true);
    await phone.disconnect();
    const next = login(credentials);
    await vi.advanceTimersByTimeAsync(1100);
    finish(); expect(await next).toBe(true);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('does not open an unregistered line or resurrect one disconnected while data loaded', async () => {
    vi.useFakeTimers();
    const phone = new DemoPhoneController(), open = vi.fn(async () => { await phone.disconnect(); });
    const login = createLineLogin(phone, open);
    const refused = login({ ...credentials, password: '' });
    await vi.advanceTimersByTimeAsync(1100);
    expect(await refused).toBe(false); expect(open).not.toHaveBeenCalled();
    const disconnected = login(credentials);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await disconnected).toBe(false);
  });

  it('opens a SIP-ready line when ADMIN refuses HTTP, never writes a fallback, then reloads the real data', async () => {
    vi.useFakeTimers();
    let allowed = false;
    const data = emptyData(); data.preferences.volume = 155;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (!allowed) return Response.json({ error: 'Accès refusé.' }, { status: 401 });
      if (path.endsWith('/line-session')) return Response.json({ ok: true });
      if (path.endsWith('/me')) return Response.json({ user: { role: 'agent', version: 1 }, endpoint: { extension: credentials.username }, csrf: 'fiction' });
      if (init?.method === 'PUT') return Response.json({ revision: 2 });
      return Response.json({ revision: 1, assignment_version: 0, data });
    });
    const store = new DataStore(new ServerPersistence('/api', fetchImpl));
    const recordings = new HttpRecordingsSource('/api', fetchImpl);
    const phone = new DemoPhoneController();
    const login = createLineLogin(phone, async (creds, profile) => {
      expect(await openLiveWorkspace(store, recordings, creds, profile)).toMatchObject({ state: 'failed' });
    });
    const attempt = login(credentials);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await attempt).toBe(true);
    expect(phone.getSnapshot().connection).toBe('ready');
    expect(store.temporarySession).toBe(true);
    store.saveContact({ name: 'Temporary', numbers: [], favorite: false });
    allowed = true;
    await expect(store.retrySave()).rejects.toThrow();
    await expect(store.flush()).rejects.toThrow();
    await expect(store.setPersist(false)).rejects.toThrow();
    await expect(store.eraseDevice()).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    store.close();
    const reopened = openLiveWorkspace(store, recordings, credentials, 'demonstration.invalid:test-line');
    await vi.advanceTimersByTimeAsync(350);
    expect(await reopened).toEqual({ state: 'open' });
    expect(store.temporarySession).toBe(false);
    expect(store.getSnapshot().preferences.volume).toBe(155);
    expect(store.getSnapshot().contacts).toHaveLength(0);
  });

  it('keeps restored data when its initial save fails, and allows retry without disconnecting SIP', async () => {
    vi.useFakeTimers();
    const data = emptyData(); data.preferences.volume = 150;
    let failSave = true;
    const persistence = { server: true, load: vi.fn(async () => data), save: vi.fn(async () => { if (failSave) throw new Error('save failed'); }), clear: vi.fn() };
    const store = new DataStore(persistence);
    const recordings = new HttpRecordingsSource('/api', async () => Response.json({ user: { role: 'agent' }, endpoint: { extension: 'test-line' }, csrf: 'fiction' }));
    const opening = openLiveWorkspace(store, recordings, credentials, 'pbx:test-line');
    await vi.advanceTimersByTimeAsync(350);
    expect(await opening).toEqual({ state: 'open' });
    expect(store.getSnapshot().preferences.volume).toBe(150);
    expect(store.temporarySession).toBe(false);
    expect(store.getSyncSnapshot()).toBe('error');
    failSave = false;
    const retry = store.retrySave(); await vi.advanceTimersByTimeAsync(350); await retry;
    expect(store.getSyncSnapshot()).toBe('saved');
  });

  it('bounds a stalled data request so it cannot indefinitely trap the sign-in screen', async () => {
    const signal = AbortSignal.abort();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const recordings = new HttpRecordingsSource('/api', async (_url, init) => {
      expect(init?.signal).toBe(signal);
      init?.signal?.throwIfAborted();
      return Response.json({});
    });
    const store = new DataStore(new ServerPersistence());
    try {
      expect(await openLiveWorkspace(store, recordings, credentials, 'pbx:test-line')).toMatchObject({ state: 'failed' });
      expect(timeout).toHaveBeenCalledWith(15000);
      expect(store.temporarySession).toBe(true);
    } finally { timeout.mockRestore(); }
  });
});
