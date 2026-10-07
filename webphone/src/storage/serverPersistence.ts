import { t } from '../i18n';
import { type AppData, emptyData } from './DataStore';
import { type Persistence } from './persistence';

export function serverData(data: AppData): AppData {
  if (!data.preferences.persist) return { ...emptyData(), preferences: { ...emptyData().preferences, persist: false } };
  return { ...data, preferences: { ...data.preferences, inputDevice: 'default', outputDevice: 'default', notifications: false } };
}

/** Session cookie and CSRF only; the server chooses the profile from the authenticated line. */
export class ServerPersistence implements Persistence {
  readonly server = true;
  private revision = 0;
  private assignmentVersion = 0;
  private csrf = '';
  private profile = '';
  private sessionVersion: number | undefined;
  constructor(private readonly base = '/api', private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

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
    this.sessionVersion = me.user.version;
    const result = await this.request('/webphone-profile');
    this.revision = result.revision;
    this.assignmentVersion = result.assignment_version;
    const remote: AppData | null = result.data;
    this.profile = profile;
    // An old device may belong to a previous holder of this line. Never auto-import it.
    return remote;
  }

  async save(profile: string, data: AppData) {
    if (profile !== this.profile) throw new Error(t('settings.saveError'));
    // A reopened account after reassignment must not accept this old in-memory profile.
    const me = await this.request('/me');
    if (me.user?.role !== 'agent' || !me.endpoint || profile.substring(profile.indexOf(':') + 1) !== me.endpoint.extension) throw new Error(t('settings.saveError'));
    if (me.user.version !== this.sessionVersion) throw new Error(t('settings.saveConflict'));
    this.csrf = me.csrf;
    const result = await this.request('/webphone-profile', { method: 'PUT', body: JSON.stringify({ revision: this.revision, data: serverData(data), assignment_version: this.assignmentVersion }) });
    this.revision = result.revision;

  }
  async clear(): Promise<void> { throw new Error('Server data cannot be erased by the device controls'); }
}
