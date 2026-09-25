import { RecordingsError, type LineCall, type LineHistory, type Period, type RecordedCall, type RecordingFile, type RecordingsIdentity, type RecordingsListing, type RecordingsSource } from './types';

type Fetch = typeof fetch;

interface ServiceRecording { id: string; state: string; duration: number | null; created_at: number }
interface ServiceEntry { entry_id?: string; id: number | null; number: string; direction: string | null; started_at: number; answered_at?: number | null; ended_at?: number | null; outcome?: string; complete?: number; recordings?: ServiceRecording[] }
interface ServiceDashboard { journal?: ServiceEntry[]; truncated?: boolean; journal_fresh?: boolean; journal_caught_up?: boolean }
interface ServiceMe { user: { name: string; role: string }; endpoint: { extension: string; alias: string } | null; csrf: string }

const UNAVAILABLE = 'Le service des enregistrements est momentanément injoignable.';

/** Local calendar day as the service expects it (YYYY-MM-DD), for the person's own clock. */
export function dayString(stamp: number): string {
  const d = new Date(stamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function periodBounds(period: Period, now = Date.now()): { from: string; to: string } {
  const day = (offset: number) => dayString(now - offset * 86_400_000);
  if (period === 'yesterday') return { from: day(1), to: day(1) };
  if (period === 'week') return { from: day(6), to: day(0) };
  return { from: day(0), to: day(0) };
}

/** Turns the service's journal into calls that carry at least one audio file. */
export function toRecordedCalls(entries: ServiceEntry[]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  for (const entry of entries) {
    const files: RecordingFile[] = (entry.recordings ?? []).map(file => ({
      id: String(file.id),
      state: file.state === 'available' ? 'available' : 'processing',
      durationSeconds: typeof file.duration === 'number' && file.duration >= 0 ? file.duration : null,
      createdAt: Math.round(file.created_at * 1000),
    }));
    if (!files.length) continue;
    calls.push({
      id: entry.entry_id ?? (entry.id === null ? 'audio:' + files[0]!.id : 'call:' + entry.id),
      number: entry.number ?? '',
      direction: entry.direction === 'inbound' ? 'inbound' : entry.direction === 'outbound' ? 'outbound' : 'unknown',
      startedAt: Math.round(entry.started_at * 1000),
      files,
    });
  }
  return calls;
}

export function toLineCalls(entries: ServiceEntry[]): LineCall[] {
  return entries.filter(entry => entry.id !== null && (entry.direction === 'inbound' || entry.direction === 'outbound'))
    .map(entry => {
      const outcome = entry.complete === 0 ? 'unknown'
        : entry.outcome === 'ANSWERED' ? 'answered'
        : entry.direction === 'inbound' && entry.outcome === 'NO_ANSWER' ? 'missed'
        : entry.outcome === 'NO_ANSWER' ? 'no-answer'
        : entry.outcome === 'BUSY' ? 'busy'
        : entry.outcome === 'CANCELLED' ? 'cancelled'
        : entry.outcome === 'FAILED' ? 'failed' : 'unknown';
      return { id: entry.entry_id ?? `call:${entry.id}`, number: entry.number ?? '', direction: entry.direction as 'inbound' | 'outbound',
        startedAt: Math.round(entry.started_at * 1000), answeredAt: entry.answered_at ? Math.round(entry.answered_at * 1000) : undefined,
        endedAt: entry.ended_at ? Math.round(entry.ended_at * 1000) : undefined, outcome };
    });
}

/**
 * The agent access of the supervision service, reached on the same origin (`/api` behind the
 * site's reverse proxy) or on a base URL allowed by the page's connection policy.
 */
export class HttpRecordingsSource implements RecordingsSource {
  private csrf = '';

  constructor(private readonly base: string, private readonly fetchImpl: Fetch = (...args) => fetch(...args)) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.base + path, {
        credentials: 'include', ...init,
        headers: { 'Content-Type': 'application/json', ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}), ...(init.headers ?? {}) },
      });
    } catch {
      throw new RecordingsError(UNAVAILABLE, 0);
    }
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || body === null || typeof body !== 'object') {
      const message = (body as { error?: string } | null)?.error;
      // A refused sign-in keeps the service's own sentence; an expired session gets a plain invitation.
      const expired = response.status === 401 && path !== '/line-session';
      throw new RecordingsError(expired ? 'Connectez-vous pour accéder à vos enregistrements.' : message ?? UNAVAILABLE, response.status);
    }
    return body as T;
  }

  private identity(me: ServiceMe): RecordingsIdentity {
    this.csrf = me.csrf;
    if (me.user.role !== 'agent' || !me.endpoint) {
      // A supervisor account would show other people's calls: not what this screen is for.
      throw new RecordingsError(me.user.role !== 'agent' ? 'Cet accès n’est pas un accès agent : utilisez celui de votre poste.' : 'Votre poste n’est plus rattaché à une équipe. Contactez votre administrateur.', 403);
    }
    return { name: me.user.name, extension: me.endpoint.extension, alias: me.endpoint.alias || undefined };
  }

  async session() {
    try {
      return this.identity(await this.request<ServiceMe>('/me'));
    } catch (error) {
      if (error instanceof RecordingsError && error.status === 401) return null;
      throw error;
    }
  }

  async openWithLine(username: string, password: string) {
    await this.request('/line-session', { method: 'POST', body: JSON.stringify({ username, password }) });
    return this.identity(await this.request<ServiceMe>('/me'));
  }

  async signOut() {
    try { await this.request('/logout', { method: 'POST', body: '{}' }); } catch { /* the cookie will expire on its own */ }
    this.csrf = '';
  }

  async list(period: Period): Promise<RecordingsListing> {
    const { from, to } = periodBounds(period);
    const data = await this.request<ServiceDashboard>(`/dashboard?from=${from}&to=${to}`);
    return { calls: toRecordedCalls(data.journal ?? []), catchingUp: data.journal_caught_up === false, stale: data.journal_fresh === false };
  }


  async history(days: number): Promise<LineHistory> {
    const bounded = Math.min(90, Math.max(1, Math.floor(days)));
    const to = dayString(Date.now());
    const from = dayString(Date.now() - (bounded - 1) * 86_400_000);
    const data = await this.request<ServiceDashboard>(`/dashboard?from=${from}&to=${to}`);
    return { calls: toLineCalls(data.journal ?? []), truncated: data.truncated === true,
      catchingUp: data.journal_caught_up === false, stale: data.journal_fresh === false };
  }

  audioUrl(fileId: string, download: boolean) {
    return `${this.base}/recordings/${encodeURIComponent(fileId)}/audio${download ? '?download=1' : ''}`;
  }
}

/** Fictional recordings for the demonstration: no network, a generated tone as audio. */
export class DemoRecordingsSource implements RecordingsSource {
  private open = false;
  constructor(private readonly now = () => Date.now()) {}

  async session() { return this.open ? this.identity() : null; }
  async openWithLine(username: string) { this.open = true; return this.identity(username); }
  async signOut() { this.open = false; }

  private identity(username = 'demo'): RecordingsIdentity {
    return { name: 'Nadia · Démonstration', extension: username || 'demo', alias: 'Nadia · accueil' };
  }

  async list(period: Period): Promise<RecordingsListing> {
    const now = this.now();
    const script: Array<[number, string, 'outbound' | 'inbound', number | null]> = [
      [6, '+33100000001', 'outbound', null], [47, '+33100000002', 'inbound', 166], [146, '+2250000000001', 'outbound', 369],
      [175, '+33100000001', 'outbound', 202], [1500, '+212500000001', 'outbound', 431], [2950, '+2250000000001', 'outbound', 512],
      [3100, '+237600000001', 'inbound', 288], [4400, '+41220000001', 'outbound', 75], [9000, '+14165550100', 'outbound', 640],
    ];
    const { from, to } = periodBounds(period, now);
    const calls = script.map(([minutesAgo, number, direction, seconds], index): RecordedCall => {
      const startedAt = now - minutesAgo * 60_000;
      return { id: `demo-audio-${index}`, number, direction, startedAt,
               files: [{ id: `demo-file-${index}`, state: seconds === null ? 'processing' : 'available', durationSeconds: seconds, createdAt: startedAt }] };
    }).filter(call => { const day = dayString(call.startedAt); return day >= from && day <= to; });
    return { calls, catchingUp: false, stale: false };
  }


  async history(days: number): Promise<LineHistory> {
    void days;
    return { calls: [], truncated: false, catchingUp: false, stale: false };
  }

  audioUrl() {
    return demoToneUrl();
  }
}

let tone: string | null = null;
/** A 12-second 440 Hz wave, built once; the same file the supervision demonstration plays. */
function demoToneUrl(): string {
  if (tone) return tone;
  const rate = 8000, seconds = 12, samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let n = 0; n < samples; n++) view.setInt16(44 + n * 2, Math.round(6000 * Math.sin(2 * Math.PI * 440 * n / rate)), true);
  tone = typeof URL !== 'undefined' && 'createObjectURL' in URL ? URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })) : '';
  return tone;
}
