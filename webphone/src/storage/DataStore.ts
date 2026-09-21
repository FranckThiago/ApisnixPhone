import { fold } from '../domain/format';
import { parseDialInput } from '../domain/numbers';
import { DEFAULT_PREFERENCES, type Callback, type CallRecord, type Contact, type Preferences } from '../domain/types';
import type { Persistence } from './persistence';

export interface AppData {
  schema: 1;
  contacts: Contact[];
  calls: CallRecord[];
  callbacks: Callback[];
  preferences: Preferences;
}

export const MAX_CALLS = 1000;
export const MAX_AGE_DAYS = 90;

export const emptyData = (): AppData => ({ schema: 1, contacts: [], calls: [], callbacks: [], preferences: { ...DEFAULT_PREFERENCES } });

const uuid = () => globalThis.crypto.randomUUID();

/**
 * Session memory by default; written to this device only after the user opted in.
 * Profiles keep accounts apart by accident-proofing, not as a security boundary.
 */
export class DataStore {
  private data: AppData = emptyData();
  private profile: string | null = null;
  private listeners = new Set<() => void>();
  private writing: Promise<void> = Promise.resolve();

  constructor(private persistence?: Persistence) {}

  getSnapshot = () => this.data;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async open(profile: string, persist: boolean, seed?: AppData) {
    // Signing in again after a network failure must not wipe what this session holds in memory.
    if (this.profile === profile) return;
    this.profile = profile;
    let loaded: AppData | null = null;
    if (persist && this.persistence) loaded = await this.persistence.load(profile).catch(() => null);
    // Data saved before callbacks existed simply has none.
    this.data = loaded?.schema === 1 ? { ...loaded, callbacks: loaded.callbacks ?? [], preferences: { ...DEFAULT_PREFERENCES, ...loaded.preferences, persist: true } }
      : { ...(seed ?? emptyData()), preferences: { ...(seed?.preferences ?? DEFAULT_PREFERENCES), persist } };
    this.prune();
    this.emit(false);
  }

  /** Logout closes the profile's data in memory. */
  close() {
    this.profile = null;
    this.data = emptyData();
    this.emit(false);
  }

  private emit(save = true) {
    this.listeners.forEach(listener => listener());
    if (save && this.profile && this.data.preferences.persist && this.persistence) {
      const profile = this.profile, data = this.data, persistence = this.persistence;
      this.writing = this.writing.then(() => persistence.save(profile, data)).catch(() => undefined);
    }
  }

  private commit(patch: Partial<AppData>) {
    this.data = { ...this.data, ...patch };
    this.emit();
  }

  private prune(now = Date.now()) {
    const oldest = now - MAX_AGE_DAYS * 86_400_000;
    const calls = this.data.calls.filter(call => call.startedAt >= oldest).sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_CALLS);
    this.data = { ...this.data, calls };
  }

  addCall(call: Omit<CallRecord, 'id' | 'tags'> & { tags?: string[] }): CallRecord {
    const record: CallRecord = { ...call, id: uuid(), tags: call.tags ?? [] };
    this.data = { ...this.data, calls: [record, ...this.data.calls] };
    this.prune();
    this.emit();
    return record;
  }

  updateCall(id: string, patch: Partial<Pick<CallRecord, 'note' | 'tags'>>) {
    this.commit({ calls: this.data.calls.map(call => (call.id === id ? { ...call, ...patch } : call)) });
  }

  removeCall(id: string) {
    this.commit({ calls: this.data.calls.filter(call => call.id !== id) });
  }

  scheduleCallback(input: Pick<Callback, 'number' | 'dueAt'> & Partial<Pick<Callback, 'name' | 'note'>>): Callback {
    const callback: Callback = { ...input, id: uuid(), createdAt: Date.now() };
    this.commit({ callbacks: [...this.data.callbacks, callback] });
    return callback;
  }

  updateCallback(id: string, patch: Partial<Pick<Callback, 'dueAt' | 'note' | 'doneAt'>>) {
    this.commit({ callbacks: this.data.callbacks.map(callback => (callback.id === id ? { ...callback, ...patch } : callback)) });
  }

  removeCallback(id: string) {
    this.commit({ callbacks: this.data.callbacks.filter(callback => callback.id !== id) });
  }

  /** The person was reached: every pending callback for that exact number is fulfilled. */
  completeCallbacksFor(dialTarget: string, now = Date.now()): number {
    const matches = this.data.callbacks.filter(callback => !callback.doneAt && parseDialInput(callback.number).dialTarget === dialTarget);
    if (matches.length) this.commit({ callbacks: this.data.callbacks.map(callback => (matches.includes(callback) ? { ...callback, doneAt: now } : callback)) });
    return matches.length;
  }

  saveContact(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Contact {
    const now = Date.now();
    const existing = input.id ? this.data.contacts.find(contact => contact.id === input.id) : undefined;
    const contact: Contact = { ...input, id: existing?.id ?? uuid(), createdAt: existing?.createdAt ?? now, updatedAt: now,
                               numbers: input.numbers.filter(number => number.value.trim()) };
    this.commit({ contacts: existing ? this.data.contacts.map(c => (c.id === contact.id ? contact : c)) : [...this.data.contacts, contact] });
    return contact;
  }

  removeContact(id: string) {
    this.commit({ contacts: this.data.contacts.filter(contact => contact.id !== id) });
  }

  toggleFavorite(id: string) {
    this.commit({ contacts: this.data.contacts.map(c => (c.id === id ? { ...c, favorite: !c.favorite, updatedAt: Date.now() } : c)) });
  }

  setPreferences(patch: Partial<Preferences>) {
    this.commit({ preferences: { ...this.data.preferences, ...patch } });
  }

  /** Turning conservation off also removes what this device had kept for the profile. */
  async setPersist(persist: boolean) {
    this.data = { ...this.data, preferences: { ...this.data.preferences, persist } };
    if (!persist && this.profile && this.persistence) await this.persistence.clear(this.profile).catch(() => undefined);
    this.emit();
  }

  /** Local data only: the central journal of the server is never touched. */
  async eraseDevice() {
    const preferences = this.data.preferences;
    this.data = { ...emptyData(), preferences };
    if (this.profile && this.persistence) await this.persistence.clear(this.profile).catch(() => undefined);
    this.emit();
  }

  flush = () => this.writing;
}

export function findContact(contacts: Contact[], dialTarget: string): Contact | undefined {
  if (!dialTarget) return undefined;
  return contacts.find(contact => contact.numbers.some(number => parseDialInput(number.value).dialTarget === dialTarget));
}

export function searchContacts(contacts: Contact[], query: string): Contact[] {
  const text = fold(query.trim());
  const digits = query.replace(/[^\d+]/g, '');
  if (!text) return contacts;
  return contacts.filter(contact =>
    fold(contact.name).includes(text) || fold(contact.company ?? '').includes(text)
    || (digits.length > 1 && contact.numbers.some(number => parseDialInput(number.value).dialTarget.includes(digits))));
}
