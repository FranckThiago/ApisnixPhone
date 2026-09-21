import { describe, expect, it } from 'vitest';
import { DataStore, findContact, MAX_CALLS, searchContacts, type AppData } from '../src/storage/DataStore';
import type { Persistence } from '../src/storage/persistence';

function memoryPersistence() {
  const saved = new Map<string, AppData>();
  const persistence: Persistence = {
    load: async profile => saved.get(profile) ?? null,
    save: async (profile, data) => void saved.set(profile, structuredClone(data)),
    clear: async profile => void saved.delete(profile),
  };
  return { saved, persistence };
}

const call = (startedAt: number) => ({
  direction: 'outbound' as const, dialTarget: '+33100000001', startedAt, endedAt: startedAt + 1000, outcome: 'answered' as const,
});

describe('data store', () => {
  it('writes nothing to the device until the user opts in, and keeps profiles apart', async () => {
    const { saved, persistence } = memoryPersistence();
    const store = new DataStore(persistence);
    await store.open('pbx:alice', false);
    store.saveContact({ name: 'Élodie Durand', numbers: [{ label: 'Mobile', value: '+33 1 00 00 00 01' }], favorite: false });
    await store.flush();
    expect(saved.size).toBe(0);
    await store.setPersist(true);
    await store.flush();
    expect(saved.get('pbx:alice')?.contacts).toHaveLength(1);
    expect(JSON.stringify([...saved.values()])).not.toMatch(/password|secret/i);
    store.close();
    await store.open('pbx:bob', true);
    expect(store.getSnapshot().contacts).toHaveLength(0);
    await store.open('pbx:alice', true);
    expect(store.getSnapshot().contacts[0]?.name).toBe('Élodie Durand');
    await store.setPersist(false);
    expect(saved.has('pbx:alice')).toBe(false);
  });

  it('bounds the history by count and age', async () => {
    const store = new DataStore();
    await store.open('p', false);
    const now = Date.now();
    store.addCall(call(now - 100 * 86_400_000));
    for (let index = 0; index < MAX_CALLS + 5; index++) store.addCall(call(now - index * 1000));
    const calls = store.getSnapshot().calls;
    expect(calls).toHaveLength(MAX_CALLS);
    expect(calls[0]!.startedAt).toBe(now);
  });

  it('matches contacts by exact dialled number and accent-insensitive name', async () => {
    const store = new DataStore();
    await store.open('p', false);
    const contact = store.saveContact({
      name: 'Élodie Durand', company: 'Azur', favorite: false,
      numbers: [{ label: 'Bureau', value: '+33 (1) 00-00-00-01' }, { label: '', value: ' ' }],
    });
    expect(contact.numbers).toHaveLength(1);
    const { contacts } = store.getSnapshot();
    expect(findContact(contacts, '+33100000001')?.id).toBe(contact.id);
    expect(findContact(contacts, '33100000001')).toBeUndefined();
    expect(searchContacts(contacts, 'elodie')).toHaveLength(1);
    expect(searchContacts(contacts, '00 00 01')).toHaveLength(1);
    expect(searchContacts(contacts, 'zzz')).toHaveLength(0);
    store.toggleFavorite(contact.id);
    expect(store.getSnapshot().contacts[0]?.favorite).toBe(true);
    await store.eraseDevice();
    expect(store.getSnapshot().contacts).toHaveLength(0);
  });
});

describe('session continuity', () => {
  it('keeps the session data when the same profile signs in again, and replaces it for another one', async () => {
    const store = new DataStore();
    await store.open('pbx:alice', false);
    store.saveContact({ name: 'Camille', numbers: [{ label: '', value: '0612345678' }], favorite: false });
    await store.open('pbx:alice', false);
    expect(store.getSnapshot().contacts).toHaveLength(1);
    await store.open('pbx:bob', false);
    expect(store.getSnapshot().contacts).toHaveLength(0);
  });
});
