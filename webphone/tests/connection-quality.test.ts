import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaReader, createQualityGate, startConnectionMonitor, type ConnectionQuality, type ConnectionSample } from '../src/connection/connection-monitor.mjs';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('400 ms connection warning', () => {
  it('ignores isolated spikes, exactly 400 ms, and event bursts', () => {
    const gate = createQualityGate();
    for (const [time, rttMs] of [[0, 800], [2000, 150], [4000, 401], [6000, 400], [8000, 900], [8001, 900], [8002, 900]])
      expect(gate.sample({ source: 'http', rttMs }, time!).level).not.toBe('slow');
    expect(gate.sample({ source: 'http', rttMs: 900 }, 12000).level).toBe('slow');
  });
  it('keeps a warning in the 300–400 band and clears only after three readings below 300', () => {
    const gate = createQualityGate();
    for (const time of [0, 2000, 4000]) gate.sample({ source: 'http', rttMs: 450 }, time);
    for (const time of [6000, 8000, 10000]) expect(gate.sample({ source: 'http', rttMs: 300 }, time).level).toBe('slow');
    expect(gate.sample({ source: 'http', rttMs: 250 }, 12000).level).toBe('slow');
    expect(gate.sample({ source: 'http', rttMs: 250 }, 14000).level).toBe('slow');
    expect(gate.sample({ source: 'http', rttMs: 250 }, 16000).level).toBe('good');
  });
  it('does not treat missing/invalid stats or a new source as confirmed recovery', () => {
    const gate = createQualityGate();
    expect(gate.sample({ source: 'offline', lost: true }, 0).level).toBe('lost');
    for (const time of [2000, 4000, 6000]) expect(gate.sample({ source: 'media', rttMs: NaN }, time).level).toBe('lost');
    gate.sample({ source: 'media', rttMs: 100 }, 8000);
    gate.sample({ source: 'media', rttMs: 100 }, 10000);
    expect(gate.sample({ source: 'http', rttMs: 100 }, 12000).level).toBe('lost');
    gate.reset();
    expect(gate.sample({ source: 'http', rttMs: 100 }, 14000).level).toBe('lost');
  });
});

function setup(fetcher: typeof fetch, readMedia?: () => Promise<ConnectionSample | null>) {
  const target = Object.assign(new EventTarget(), { navigator: { onLine: true }, fetch: fetcher });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const values: ConnectionQuality[] = [];
  const stop = startConnectionMonitor({ url: 'https://pbx.example/connection-check.php', readMedia,
    target: target as unknown as Window, doc: doc as unknown as Document, onChange: s => values.push(s) });
  return { target, doc, values, stop };
}

describe('passive probe lifecycle', () => {
  it('uses credential-free uncached probes; offline is immediate and online must recover', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const { target, values, stop } = setup(fetcher);
    await vi.advanceTimersByTimeAsync(4500);
    expect(values.at(-1)?.level).toBe('good');
    expect(fetcher.mock.calls[0]).toEqual([expect.stringContaining('?t='), expect.objectContaining({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })]);
    target.navigator.onLine = false; target.dispatchEvent(new Event('offline'));
    expect(values.at(-1)?.level).toBe('lost');
    target.navigator.onLine = true; target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(2100);
    expect(values.at(-1)?.level).toBe('lost');
    await vi.advanceTimersByTimeAsync(2100);
    expect(values.at(-1)?.level).toBe('good');
    stop(); const calls = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    target.dispatchEvent(new Event('online'));
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });
  it('does not accept an HTML fallback or HTTP error as a good measurement', async () => {
    vi.useFakeTimers();
    const { values, stop } = setup(async () => new Response('<html/>', { status: 200 }));
    await vi.advanceTimersByTimeAsync(4500);
    expect(values.at(-1)?.level).toBe('lost'); stop();
  });
  it('bounds hanging requests and never overlaps them', async () => {
    vi.useFakeTimers();
    let active = 0, maximum = 0;
    const { values, stop } = setup((_url, options) => new Promise((_resolve, reject) => {
      maximum = Math.max(maximum, ++active);
      options!.signal!.addEventListener('abort', () => { active--; reject(new Error('timeout')); });
    }));
    await vi.advanceTimersByTimeAsync(16500);
    expect(maximum).toBe(1); expect(values.at(-1)?.level).toBe('lost'); stop();
  });
  it('cancels a slow request on backgrounding and ignores its late result', async () => {
    vi.useFakeTimers();
    let resolve!: (r: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; }));
    const { values, doc, stop } = setup(fetcher);
    await vi.advanceTimersByTimeAsync(1);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    resolve(new Response(null, { status: 204 }));
    await vi.advanceTimersByTimeAsync(20000);
    expect(values).toHaveLength(0); expect(fetcher).toHaveBeenCalledTimes(1); stop();
  });
  it('falls back when the media reader stalls', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const { stop } = setup(fetcher, () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(701);
    expect(fetcher).toHaveBeenCalledTimes(1); stop();
  });
  it('uses media latency instead of probing HTTP during an established call', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const key = {};
    const { values, stop } = setup(fetcher, async () => ({ source: 'media', rttMs: 450, key }));
    await vi.advanceTimersByTimeAsync(4500);
    expect(values.at(-1)).toEqual({ level: 'slow', source: 'media' });
    expect(fetcher).not.toHaveBeenCalled(); stop();
  });
});

describe('audio path latency', () => {
  it('reads the selected path in milliseconds, expires stale stats and tolerates unsupported stats', async () => {
    vi.useFakeTimers();
    const read = createMediaReader();
    const pair = { id: 'selected', type: 'candidate-pair', currentRoundTripTime: .45, responsesReceived: 3 };
    const pc = { connectionState: 'connected', getStats: async () => new Map<string, unknown>([
      ['other', { type: 'candidate-pair', currentRoundTripTime: .01 }],
      ['transport', { type: 'transport', selectedCandidatePairId: 'selected' }], ['selected', pair],
    ]) };
    expect(await read(pc as unknown as RTCPeerConnection)).toEqual({ source: 'media', rttMs: 450 });
    await vi.advanceTimersByTimeAsync(10001);
    expect(await read(pc as unknown as RTCPeerConnection)).toBeNull();
    pair.responsesReceived++;
    expect(await read(pc as unknown as RTCPeerConnection)).toMatchObject({ rttMs: 450 });
    pc.connectionState = 'disconnected';
    expect(await read(pc as unknown as RTCPeerConnection)).toEqual({ source: 'media', lost: true });
    pc.connectionState = 'closed'; expect(await read(pc as unknown as RTCPeerConnection)).toBeNull();
    expect(await read()).toBeNull();
  });
});
