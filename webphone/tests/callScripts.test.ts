import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCallScript, watchCallScript, type CallScript } from '../src/callScripts/client';

const script: CallScript = { title: 'Accueil', content: 'Bonjour.\nComment puis-je vous aider ?', revision: 1 };
afterEach(() => vi.useRealTimers());

describe('assigned call script', () => {
  it('reads only the authenticated line, without endpoint selectors or browser storage', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ script }));
    expect(await loadCallScript('/api/', fetcher)).toEqual(script);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/call-script');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', cache: 'no-store' });
  });
  it('clears a disabled/revoked script and rejects malformed payloads', async () => {
    for (const status of [401, 403]) expect(await loadCallScript('/api', async () => new Response(null, { status }))).toBeNull();
    expect(await loadCallScript('/api', async () => Response.json({ script: null }))).toBeNull();
    for (const data of [{}, { script: {} }, { script: { ...script, content: 'x'.repeat(12001) } }, { script: { ...script, revision: 0 } }]) {
      await expect(loadCallScript('/api', async () => Response.json(data))).rejects.toThrow();
    }
    await expect(loadCallScript('/api', async () => new Response(null, { status: 503 }))).rejects.toThrow();
  });
  it('refreshes once a minute, on return and reconnection, without overlapping', async () => {
    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { hidden: false }), network = new EventTarget();
    let resolve!: (value: CallScript | null) => void;
    const load = vi.fn(() => new Promise<CallScript | null>(done => { resolve = done; })), publish = vi.fn();
    const stop = watchCallScript(load, publish, page, network);
    network.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(script); await Promise.resolve(); expect(publish).toHaveBeenLastCalledWith(script);
    page.hidden = true; await vi.advanceTimersByTimeAsync(60000); expect(load).toHaveBeenCalledTimes(1);
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); expect(load).toHaveBeenCalledTimes(2);
    resolve(null); await Promise.resolve(); expect(publish).toHaveBeenLastCalledWith(null);
    network.dispatchEvent(new Event('online')); expect(load).toHaveBeenCalledTimes(3);
    stop(); const count = publish.mock.calls.length;
    resolve(script); await Promise.resolve(); expect(publish).toHaveBeenCalledTimes(count);
    await vi.advanceTimersByTimeAsync(60000); network.dispatchEvent(new Event('focus'));
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('keeps an already received script readable during a temporary network outage', async () => {
    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { hidden: false }), network = new EventTarget(), publish = vi.fn();
    const load = vi.fn().mockResolvedValueOnce(script).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null);
    const stop = watchCallScript(load, publish, page, network);
    await vi.advanceTimersByTimeAsync(60001);
    expect(publish).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenLastCalledWith(script);
    await vi.advanceTimersByTimeAsync(60000); expect(publish).toHaveBeenLastCalledWith(null);
    stop();
  });
});
