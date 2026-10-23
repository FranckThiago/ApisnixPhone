/** Public, versioned protocol. Credentials are never part of this channel. */
export const PROTOCOL = 'apisnixphone.embed.v1';
export type Envelope = { protocol: typeof PROTOCOL; channel: string; type: string };
export type Command = Envelope & { type: 'prepare-call'; requestId: string; number: string };
export type ResultCode = 'prepared' | 'not-connected' | 'call-in-progress' | 'invalid-number';
export type PublicState = { connection: string; phone: string | null; sessionOpen: boolean; demo: boolean; inCall: boolean };
export type PublicCall = { id: string; direction: string; number: string; phase: string; startedAt: number; answeredAt?: number; endedAt?: number; outcome?: string };
export type PhoneEvent =
  | { type: 'ready' }
  | { type: 'state'; state: PublicState }
  | { type: 'call'; call: PublicCall }
  | { type: 'result'; requestId: string; code: ResultCode };

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function envelope(value: unknown): value is Envelope & Record<string, unknown> {
  return object(value) && value.protocol === PROTOCOL && typeof value.type === 'string'
    && typeof value.channel === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value.channel);
}
export function command(value: unknown): value is Command {
  return envelope(value) && object(value) && value.type === 'prepare-call'
    && typeof value.requestId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.requestId)
    && typeof value.number === 'string' && value.number.length <= 40;
}
export function phoneEvent(value: unknown): value is PhoneEvent & Envelope {
  if (!envelope(value) || !object(value)) return false;
  if (value.type === 'ready') return true;
  if (value.type === 'result') return typeof value.requestId === 'string'
    && ['prepared', 'not-connected', 'call-in-progress', 'invalid-number'].includes(String(value.code));
  if (value.type === 'state') return object(value.state) && typeof value.state.connection === 'string'
    && (value.state.phone === null || typeof value.state.phone === 'string')
    && typeof value.state.sessionOpen === 'boolean' && typeof value.state.demo === 'boolean' && typeof value.state.inCall === 'boolean';
  if (value.type === 'call') {
    const call = value.call;
    return object(call) && ['id', 'direction', 'number', 'phase'].every(key => typeof call[key] === 'string') && typeof call.startedAt === 'number';
  }
  return false;
}

/** HTTPS in production; loopback HTTP only for local integration development. */
export function safeOrigin(value: string, local: boolean): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol === 'https:' || local && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
  } catch { /* A malformed origin cannot authorize a parent. */ }
  return null;
}
export function allowedOrigins(config: string | undefined, ownOrigin: string, demo: boolean, development = false): Set<string> {
  const origins = new Set((config ?? '').split(',').map(s => safeOrigin(s.trim(), demo || development)).filter((s): s is string => s !== null));
  // The local demo works without provisioning a customer. Live is closed by default.
  if (demo && safeOrigin(ownOrigin, true)) origins.add(ownOrigin);
  return origins;
}
export function authorizedMessage(event: Pick<MessageEvent, 'source' | 'origin' | 'data'>, parent: Window, origins: Set<string>, channel?: string): boolean {
  return event.source === parent && origins.has(event.origin) && envelope(event.data)
    && (channel === undefined || event.data.channel === channel);
}
export function phoneHint(search: string): string {
  const value = new URLSearchParams(search).get('phone') ?? '';
  return /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : '';
}
