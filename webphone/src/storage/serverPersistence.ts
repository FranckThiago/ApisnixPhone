import { t } from '../i18n';
import { type AppData, emptyData } from './DataStore';
import { indexedDbPersistence, type Persistence } from './persistence';

export function serverData(data: AppData): AppData {
  return { ...data, preferences: { ...data.preferences, persist: true, inputDevice: 'default', outputDevice: 'default', notifications: false } };
}

/** Session cookie and CSRF only; the server chooses the profile from the authenticated line. */
export class ServerPersistence implements Persistence {
  readonly server = true;
  private revision = 0;
  private csrf = '';
  private profile = '';
  private imported = false;
  constructor(private readonly base = '/api', private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
              private readonly legacy: Persistence = indexedDbPersistence) {}

  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.fetchImpl(this.base + path, { credentials: 'include', ...init, signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf } });
    } catch { throw new Error(t('settings.saveError')); }
    if (!response.ok) throw new Error(t(response.status === 409 ? 'settings.saveConflict' : 'settings.saveError'));
    return response.json();
  }

  async load(profile: string): Promise<AppData | null> {
    this.profile = '';
    const me = await this.request('/me');
    if (me.user?.role !== 'agent' || !me.endpoint || profile.substring(profile.indexOf(':') + 1) !== me.endpoint.extension) throw new Error(t('settings.saveError'));
    this.csrf = me.csrf;
    const result = await this.request('/webphone-profile');
    this.revision = result.revision;
    const remote: AppData | null = result.data;
    this.profile = profile;
    let migrated = false;
    try { migrated = localStorage.getItem(`apisnixphone.imported.${profile}`) === '1'; } catch { /* private mode */ }
    const local = migrated ? null : await this.legacy.load(profile).catch(() => null);
    this.imported = !local;
    if (!local) return remote;
    const merged = remote ?? emptyData();
    const merge = <T extends { id: string }>(current: T[], old: T[]) => {
      const known = new Set(current.map(item => item.id));
      return [...current, ...old.filter(item => !known.has(item.id))];
    };
    merged.contacts = merge(merged.contacts, local.contacts);
    merged.calls = merge(merged.calls, local.calls);
    merged.callbacks = merge(merged.callbacks ?? [], local.callbacks ?? []);
    if (!remote) merged.preferences = { ...merged.preferences, ...local.preferences, persist: true };
    return merged;
  }

  async save(profile: string, data: AppData) {
    if (profile !== this.profile) throw new Error(t('settings.saveError'));
    // Reconnection renews the HTTP session and CSRF without discarding unsaved data.
    const me = await this.request('/me');
    if (me.user?.role !== 'agent' || !me.endpoint || profile.substring(profile.indexOf(':') + 1) !== me.endpoint.extension) throw new Error(t('settings.saveError'));
    this.csrf = me.csrf;
    const result = await this.request('/webphone-profile', { method: 'PUT', body: JSON.stringify({ revision: this.revision, data: serverData(data) }) });
    this.revision = result.revision;
    if (!this.imported) {
      try { localStorage.setItem(`apisnixphone.imported.${profile}`, '1'); } catch { /* private mode */ }
      this.imported = true;
    }
  }
  async clear(): Promise<void> { throw new Error('Server data cannot be erased by the device controls'); }
}
