import { sessionFetch } from '../http/embeddedSession';
import { t } from '../i18n';

/** One message left on the voicemail of the signed-in phone. */
export interface VoiceMessage {
  id: string;
  caller: string;
  name: string;
  receivedAt: number;
  durationSeconds: number | null;
  /** `new` until it has been listened to on the telephone menu. */
  unread: boolean;
}

export interface VoicemailSource {
  list(): Promise<VoiceMessage[]>;
  /** A playable or downloadable address of the message's audio. */
  audioUrl(id: string): Promise<string>;
  remove(id: string): Promise<void>;
}

interface ServiceMessage { id: string; caller: string; name: string; received_at: number; duration: number | null; folder: string }

export function toVoiceMessages(value: unknown): VoiceMessage[] {
  const messages = (value as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) throw new Error(t('voicemail.unavailable'));
  return (messages as ServiceMessage[]).filter(item => item && typeof item.id === 'string' && typeof item.received_at === 'number').map(item => ({
    id: item.id, caller: String(item.caller ?? ''), name: String(item.name ?? ''), receivedAt: item.received_at * 1000,
    durationSeconds: typeof item.duration === 'number' && item.duration >= 0 ? item.duration : null, unread: item.folder === 'new',
  }));
}

/** The supervision service reads the mailbox of the signed-in phone on the PBX; the browser never names a mailbox. */
export class HttpVoicemailSource implements VoicemailSource {
  constructor(private readonly base: string, private readonly fetchImpl: typeof fetch = (...args) => sessionFetch(...args)) {}

  private async call(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.fetchImpl(this.base + path, { credentials: 'include', cache: 'no-store', ...init, signal: AbortSignal.timeout(45000) });
    } catch { throw new Error(t('voicemail.unavailable')); }
    if (!response.ok) throw new Error(t(response.status === 401 || response.status === 403 ? 'voicemail.denied' : 'voicemail.unavailable'));
    return response;
  }

  async list() { return toVoiceMessages(await (await this.call('/voicemail')).json()); }

  async audioUrl(id: string) {
    const response = await this.call(`/voicemail/${encodeURIComponent(id)}/audio`);
    return URL.createObjectURL(await response.blob());
  }

  async remove(id: string) {
    const me = await (await this.call('/me')).json() as { csrf?: string };
    if (!me.csrf) throw new Error(t('voicemail.denied'));
    await this.call(`/voicemail/${encodeURIComponent(id)}/delete`, { method: 'POST', headers: { 'X-CSRF-Token': me.csrf, 'Content-Type': 'application/json' }, body: '{}' });
  }
}

/** Fictional messages for the demonstration: no network, a generated tone as audio. */
export class DemoVoicemailSource implements VoicemailSource {
  private removed = new Set<string>();
  constructor(private readonly tone: () => string | Promise<string>, private readonly now = () => Date.now()) {}
  async list() {
    const now = this.now();
    const messages: VoiceMessage[] = [
      { id: 'demo-vm-1', caller: '+33100000002', name: '', receivedAt: now - 25 * 60_000, durationSeconds: 12, unread: true },
      { id: 'demo-vm-2', caller: '+2250000000001', name: '', receivedAt: now - 26 * 3_600_000, durationSeconds: 12, unread: false },
    ];
    return messages.filter(message => !this.removed.has(message.id));
  }
  async audioUrl() { return this.tone(); }
  async remove(id: string) { this.removed.add(id); }
}
