import { describe, expect, it, vi } from 'vitest';
import { DemoVoicemailSource, HttpVoicemailSource, toVoiceMessages } from '../src/voicemail/client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('voicemail client', () => {
  it('maps the service listing and ignores malformed entries', () => {
    expect(toVoiceMessages({ messages: [
      { id: 'a-1', caller: '0612', name: 'Jean', received_at: 2000, duration: 9, folder: 'new' },
      { id: 'a-2', caller: '', name: '', received_at: 1000, duration: null, folder: 'old' }, { caller: 'x' }, null,
    ] })).toEqual([
      { id: 'a-1', caller: '0612', name: 'Jean', receivedAt: 2_000_000, durationSeconds: 9, unread: true },
      { id: 'a-2', caller: '', name: '', receivedAt: 1_000_000, durationSeconds: null, unread: false },
    ]);
    expect(() => toVoiceMessages({})).toThrow();
  });
  it('never sends a mailbox, and deletes with the session CSRF token', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/me')) return json({ csrf: 'token' });
      if (url.endsWith('/delete')) return json({ ok: true });
      void init;
      return json({ messages: [] });
    });
    const source = new HttpVoicemailSource('/api', fetchImpl as unknown as typeof fetch);
    expect(await source.list()).toEqual([]);
    await source.remove('a 1');
    expect(fetchImpl.mock.calls.map(call => String(call[0]))).toEqual(['/api/voicemail', '/api/me', '/api/voicemail/a%201/delete']);
    const sent = fetchImpl.mock.calls[2]![1]!;
    expect(sent.method).toBe('POST');
    expect((sent.headers as Record<string, string>)['X-CSRF-Token']).toBe('token');
  });
  it('explains a refusal and an outage differently', async () => {
    const denied = new HttpVoicemailSource('/api', (async () => json({}, 403)) as unknown as typeof fetch);
    const down = new HttpVoicemailSource('/api', (async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    await expect(denied.list()).rejects.toThrow(/accès|access|acceso/);
    await expect(down.list()).rejects.toThrow();
  });
  it('keeps demo deletions for the session', async () => {
    const demo = new DemoVoicemailSource(() => 'blob:tone', () => 1_000_000_000);
    expect((await demo.list()).map(m => m.id)).toEqual(['demo-vm-1', 'demo-vm-2']);
    await demo.remove('demo-vm-1');
    expect((await demo.list()).map(m => m.id)).toEqual(['demo-vm-2']);
    expect(await demo.audioUrl()).toBe('blob:tone');
  });
});
