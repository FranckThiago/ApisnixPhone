import type { AppData } from './DataStore';

export interface Persistence {
  load(profile: string): Promise<AppData | null>;
  save(profile: string, data: AppData): Promise<void>;
  clear(profile: string): Promise<void>;
}

const DATABASE = 'apisnixphone';
const STORE = 'profiles';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

/** Contacts, notes and history of one profile. Never a SIP password. */
export const indexedDbPersistence: Persistence = {
  load: async profile => ((await run('readonly', store => store.get(profile))) as AppData | undefined) ?? null,
  save: async (profile, data) => void (await run('readwrite', store => store.put(data, profile))),
  clear: async profile => void (await run('readwrite', store => store.delete(profile))),
};

const flag = (profile: string) => `apisnixphone.persist.${profile}`;

/** The opt-in itself is the only thing remembered before the user chooses. */
export const persistChoice = {
  get: (profile: string) => { try { return localStorage.getItem(flag(profile)) === '1'; } catch { return false; } },
  set: (profile: string, value: boolean) => {
    try { if (value) localStorage.setItem(flag(profile), '1'); else localStorage.removeItem(flag(profile)); } catch { /* private mode */ }
  },
};
