import { describe, expect, it } from 'vitest';
import { DemoRecordingsSource, HttpRecordingsSource, periodBounds, toRecordedCalls } from '../src/recordings/client';
import { RecordingsError, type RecordingsSource } from '../src/recordings/types';

type Call = { url: string; init: RequestInit };
function fakeService(routes: Record<string, (init: RequestInit) => { status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const path = url.replace(/^\/api/, '').split('?')[0]!;
    const route = routes[`${init.method ?? 'GET'} ${path}`];
    const answer = route ? route(init) : { status: 404, body: { error: 'Élément introuvable.' } };
    return new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const me = (role: string, endpoint: object | null = { extension: 'D1001', alias: 'Nadia' }) =>
  ({ status: 200, body: { user: { name: 'Nadia', role }, endpoint, csrf: 'token-1' } });

describe('recordings client', () => {
  it('maps the service journal to calls that carry audio, newest first as served', () => {
    const calls = toRecordedCalls([
      { entry_id: 'call:7', id: 7, number: '0100000001', direction: 'outbound', started_at: 1700000000.4,
        recordings: [{ id: 'r1', state: 'available', duration: 58, created_at: 1700000000 }, { id: 'r2', state: 'processing', duration: null, created_at: 1700000001 }] },
      { entry_id: 'call:8', id: 8, number: '0100000002', direction: 'inbound', started_at: 1700000100, recordings: [] },
      { entry_id: 'audio:r3', id: null, number: '', direction: null, started_at: 1700000200, recordings: [{ id: 'r3', state: 'available', duration: -1, created_at: 1700000200 }] },
    ]);
    expect(calls.map(call => call.id)).toEqual(['call:7', 'audio:r3']);
    expect(calls[0]!.files).toEqual([
      { id: 'r1', state: 'available', durationSeconds: 58, createdAt: 1700000000000 },
      { id: 'r2', state: 'processing', durationSeconds: null, createdAt: 1700000001000 },
    ]);
    expect(calls[0]!.startedAt).toBe(1700000000400);
    expect(calls[1]).toMatchObject({ direction: 'unknown', number: '', files: [{ durationSeconds: null }] });
  });

  it('computes the period in the local calendar', () => {
    const noon = new Date(2026, 8, 24, 12).getTime();
    expect(periodBounds('today', noon)).toEqual({ from: '2026-09-24', to: '2026-09-24' });
    expect(periodBounds('yesterday', noon)).toEqual({ from: '2026-09-23', to: '2026-09-23' });
    expect(periodBounds('week', noon)).toEqual({ from: '2026-09-18', to: '2026-09-24' });
  });

  it('opens a session, sends the CSRF token on writes and lists only the agent scope', async () => {
    const { calls, fetchImpl } = fakeService({
      'GET /me': () => me('agent'),
      'POST /line-session': init => (JSON.parse(String(init.body)).password === 'good' ? { status: 200, body: { ok: true } } : { status: 401, body: { error: 'Identifiant ou mot de passe de la ligne incorrect.' } }),
      'POST /logout': init => ((init.headers as Record<string, string>)['X-CSRF-Token'] === 'token-1' ? { status: 200, body: { ok: true } } : { status: 403, body: { error: 'Accès refusé.' } }),
      'GET /dashboard': () => ({ status: 200, body: { journal: [{ entry_id: 'call:1', id: 1, number: '0100', direction: 'outbound', started_at: 1, recordings: [{ id: 'x', state: 'available', duration: 3, created_at: 1 }] }], journal_fresh: true, journal_caught_up: false } }),
    });
    const source = new HttpRecordingsSource('/api', fetchImpl);
    await expect(source.openWithLine('D1001', 'bad')).rejects.toMatchObject({ status: 401, message: 'Identifiant ou mot de passe de la ligne incorrect.' });
    const identity = await source.openWithLine('D1001', 'good');
    expect(identity).toEqual({ name: 'Nadia', extension: 'D1001', alias: 'Nadia' });
    const listing = await source.list('today');
    expect(listing.calls).toHaveLength(1);
    expect(listing.catchingUp).toBe(true);
    expect(calls.find(call => call.url.includes('/dashboard'))!.url).toMatch(/\/api\/dashboard\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    expect(source.audioUrl('demo:0', false)).toBe('/api/recordings/demo%3A0/audio');
    expect(source.audioUrl('demo:0', true)).toBe('/api/recordings/demo%3A0/audio?download=1');
    await source.signOut();
    expect(calls.at(-1)!.url).toBe('/api/logout');
    // The line's password travels once, to the line-session request only.
    expect(calls.filter(call => JSON.stringify(call.init).includes('good'))).toHaveLength(1);
  });

  it('refuses a supervisor account and reports a closed session without a password prompt loop', async () => {
    const { fetchImpl } = fakeService({ 'GET /me': () => me('supervisor', null), 'POST /line-session': () => ({ status: 200, body: { ok: true } }) });
    const source = new HttpRecordingsSource('/api', fetchImpl);
    await expect(source.openWithLine('sup', 'x')).rejects.toBeInstanceOf(RecordingsError);
    const closed = new HttpRecordingsSource('/api', fakeService({ 'GET /me': () => ({ status: 401, body: { error: 'Connectez-vous pour continuer.' } }) }).fetchImpl);
    expect(await closed.session()).toBeNull();
    const down = new HttpRecordingsSource('/api', (async () => { throw new TypeError('network'); }) as unknown as typeof fetch);
    await expect(down.session()).rejects.toMatchObject({ status: 0 });
  });

  it('demonstration source stays offline and filters by period', async () => {
    const now = new Date(2026, 8, 24, 12).getTime();
    const source: RecordingsSource = new DemoRecordingsSource(() => now);
    expect(await source.session()).toBeNull();
    await source.openWithLine('demo', 'anything');
    const today = await source.list('today');
    const week = await source.list('week');
    expect(today.calls.length).toBeGreaterThan(0);
    expect(week.calls.length).toBeGreaterThanOrEqual(today.calls.length);
    expect(today.calls.every(call => call.startedAt <= now && call.startedAt >= now - 12 * 3_600_000)).toBe(true);
    expect(today.calls.some(call => call.files[0]!.state === 'processing')).toBe(true);
  });
});
