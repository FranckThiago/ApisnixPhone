import { describe, expect, it } from 'vitest';
import { DataStore, emptyData, type AppData } from '../src/storage/DataStore';
import { ServerPersistence, serverData } from '../src/storage/serverPersistence';
import type { Persistence } from '../src/storage/persistence';

function fixture(local: AppData | null = null, extension = 'alice') {
  let stored: AppData | null = null, revision = 0, fail = false;
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url); requests.push({ path, init });
    if (fail) throw new Error('offline');
    if (path.endsWith('/me')) return Response.json({ user: { role: 'agent' }, endpoint: { extension }, csrf: 'fictional-token' });
    if (init?.method !== 'PUT') return Response.json({ data: stored, revision });
    const body = JSON.parse(String(init.body));
    if (body.revision !== revision) return Response.json({}, { status: 409 });
    stored = structuredClone(body.data); return Response.json({ revision: ++revision });
  };
  const legacy: Persistence = { load: async () => local, save: async () => { throw new Error('Never write legacy'); }, clear: async () => { throw new Error('Never erase legacy'); } };
  const persistence = new ServerPersistence('/api', fetchImpl, legacy);
  return { persistence, requests, stored: () => stored, fail: (value: boolean) => { fail = value; }, concurrent: () => { revision++; } };
}

const contact = { name: 'Fiction', numbers: [{ label: '', value: '1001' }], favorite: true };

describe('server profiles', () => {
  it('always saves real profiles and restores data across devices without opting in', async () => {
    const f = fixture();
    const first = new DataStore(f.persistence);
    await first.open('pbx:alice', false);
    first.saveContact(contact);
    first.scheduleCallback({ number: '1001', dueAt: Date.now() });
    first.setPreferences({ volume: 140, theme: 'light', language: 'es', inputDevice: 'local-mic', outputDevice: 'local-speaker', notifications: true });
    expect(first.getSyncSnapshot()).toBe('saving');
    await first.flush();
    expect(first.getSyncSnapshot()).toBe('saved');
    const second = new DataStore(f.persistence);
    await second.open('pbx:alice', true);
    expect(second.getSnapshot().contacts[0]?.name).toBe('Fiction');
    expect(second.getSnapshot().callbacks).toHaveLength(1);
    expect(second.getSnapshot().preferences).toMatchObject({ volume: 140, theme: 'light', language: 'es', inputDevice: 'default', outputDevice: 'default', notifications: false, persist: true });
    expect(f.requests.at(-1)?.init).toMatchObject({ credentials: 'include', headers: { 'X-CSRF-Token': 'fictional-token' } });
    expect(JSON.stringify(f.stored())).not.toMatch(/password|local-mic|local-speaker/);
    await second.setPersist(false);
    await second.eraseDevice();
    expect(second.getSnapshot().contacts).toHaveLength(1);
  });

  it('imports contacts, notes and callbacks from legacy IndexedDB without erasing the source', async () => {
    const local = emptyData();
    local.contacts = [{ ...contact, id: 'legacy', note: 'Keep me', createdAt: 1, updatedAt: 1 }];
    local.callbacks = [{ id: 'callback', number: '1001', dueAt: Date.now(), createdAt: 1 }];
    local.preferences.volume = 170;
    const f = fixture(local), store = new DataStore(f.persistence);
    await store.open('pbx:alice', true);
    expect(f.stored()?.contacts[0]?.note).toBe('Keep me');
    expect(f.stored()?.callbacks).toHaveLength(1);
    expect(f.stored()?.preferences.volume).toBe(170);
    expect(local.contacts).toHaveLength(1);
  });

  it('reports failed saves, retains changes and retries the latest snapshot', async () => {
    const f = fixture(), store = new DataStore(f.persistence);
    await store.open('pbx:alice', true);
    f.fail(true);
    store.saveContact(contact);
    await expect(store.flush()).rejects.toThrow();
    expect(store.getSyncSnapshot()).toBe('error');
    store.setPreferences({ volume: 150 });
    await expect(store.flush()).rejects.toThrow();
    expect(store.getSnapshot().contacts).toHaveLength(1);
    f.fail(false);
    await store.retrySave();
    expect(f.stored()?.contacts).toHaveLength(1);
    expect(f.stored()?.preferences.volume).toBe(150);
  });

  it('never replaces inaccessible server data with an empty profile', async () => {
    const f = fixture(); f.fail(true);
    const store = new DataStore(f.persistence);
    await expect(store.open('pbx:alice', true)).rejects.toThrow();
    expect(f.requests.some(r => r.init?.method === 'PUT')).toBe(false);
    const mismatch = fixture(null, 'bob');
    await expect(new DataStore(mismatch.persistence).open('pbx:alice', true)).rejects.toThrow();
    expect(mismatch.requests).toHaveLength(1);
  });

  it('refuses concurrent snapshots, and can reopen after a deliberate discard', async () => {
    const f = fixture(), store = new DataStore(f.persistence);
    await store.open('pbx:alice', true);
    f.concurrent();
    store.saveContact(contact);
    await expect(store.flush()).rejects.toThrow(/autre appareil/);
    expect(f.stored()?.contacts).toHaveLength(0);
    store.close();
    await store.open('pbx:alice', true);
    expect(store.getSnapshot().contacts).toHaveLength(0);
  });

  it('does not mutate local device preferences when serializing', () => {
    const data = emptyData(); data.preferences.inputDevice = 'my-mic';
    expect(serverData(data).preferences.inputDevice).toBe('default');
    expect(data.preferences.inputDevice).toBe('my-mic');
  });
});
