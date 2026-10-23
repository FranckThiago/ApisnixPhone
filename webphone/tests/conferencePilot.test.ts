import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bridgeState, ConferenceSimulation, disconnectedBridge, mountConferencePilot, PILOT_PROTOCOL, pilotEnabled } from '../src/vicidial/pilot';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('the pilot is disabled for all release builds, live development, and public hosts', () => {
  expect(pilotEnabled(true, 'demo', '127.0.0.1')).toBe(true);
  expect(pilotEnabled(false, 'demo', '127.0.0.1')).toBe(false);
  expect(pilotEnabled(true, 'live', 'localhost')).toBe(false);
  expect(pilotEnabled(true, 'demo', 'phone.example')).toBe(false);
});
it('connects one simulated bridge, survives elapsed campaign time, mutes and reconnects explicitly', async () => {
  const simulation = new ConferenceSimulation();
  const pending = simulation.join();
  await vi.advanceTimersByTimeAsync(1100); await pending;
  const id = bridgeState(simulation.phone).bridgeId;
  expect(id).toBeTruthy();
  simulation.phone.setMuted(true);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(bridgeState(simulation.phone)).toEqual({ connected: true, bridgeId: id, muted: true });
  await simulation.leave();
  expect(bridgeState(simulation.phone)).toEqual(disconnectedBridge);
  const again = simulation.join(); await vi.advanceTimersByTimeAsync(1100); await again;
  expect(bridgeState(simulation.phone).bridgeId).not.toBe(id);
  await simulation.leave();
});
function harness() {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_APP_MODE', 'demo');
  const listeners = new Map<string, (event: MessageEvent) => void>();
  const frameListeners = new Map<string, () => void>();
  const frame = { contentWindow: { postMessage: vi.fn() }, style: {}, src: '', title: '', referrerPolicy: '', remove: vi.fn(),
    addEventListener: (key: string, value: () => void) => frameListeners.set(key, value), removeEventListener: (key: string) => frameListeners.delete(key) };
  vi.stubGlobal('window', { addEventListener: (key: string, fn: (event: MessageEvent) => void) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) });
  vi.stubGlobal('document', { createElement: () => frame });
  const onState = vi.fn();
  const client = mountConferencePilot({ append() {} } as unknown as HTMLElement, 'http://127.0.0.1:5186', onState);
  frameListeners.get('load')!();
  const channel = frame.contentWindow.postMessage.mock.calls[0]![0].channel;
  const receive = (patch = {}) => listeners.get('message')!({ origin: 'http://127.0.0.1:5186', source: frame.contentWindow,
    data: { protocol: PILOT_PROTOCOL, channel, type: 'bridge', state: { connected: true, bridgeId: 'audio', muted: false } }, ...patch } as unknown as MessageEvent);
  return { client, onState, receive, frameListeners };
}
it('rejects other origins, frames, channels and malformed audio state', () => {
  const h = harness(); h.onState.mockClear();
  h.receive({ origin: 'https://attacker.invalid' }); h.receive({ source: {} });
  h.receive({ data: { protocol: PILOT_PROTOCOL, channel: 'wrong', type: 'bridge', state: {} } });
  expect(h.onState).not.toHaveBeenCalled();
  h.receive(); expect(h.onState).toHaveBeenCalledTimes(1);
  h.receive(); expect(h.onState).toHaveBeenCalledTimes(1);
  h.client.destroy();
});
it('losing heartbeats or reloading the frame invalidates audio readiness', () => {
  const h = harness(); h.receive();
  vi.advanceTimersByTime(4000); expect(h.onState).toHaveBeenLastCalledWith(disconnectedBridge);
  h.receive(); h.frameListeners.get('load')!(); expect(h.onState).toHaveBeenLastCalledWith(disconnectedBridge);
  h.client.destroy();
});
