import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStore } from '../src/storage/DataStore';
import { bindWorkspaceLineSounds } from '../src/telephony/lineSounds';
import type { PhoneController, PhoneSnapshot } from '../src/telephony/types';

function harness() {
  let state: PhoneSnapshot = { demo: false, connection: 'registering', account: { username: 'test', domain: 'example.invalid' }, call: null };
  const listeners = new Set<() => void>();
  const phone = { getSnapshot: () => state, subscribe: (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; } } as PhoneController;
  const store = new DataStore();
  const play = vi.fn();
  return { phone, store, play, bind: () => bindWorkspaceLineSounds(phone, store, play),
    update(patch: Partial<PhoneSnapshot>) { state = { ...state, ...patch }; listeners.forEach(f => f()); } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('workspace connection sounds', () => {
  it('waits for the workspace mount and a registered line, then announces once at its volume', async () => {
    const h = harness(); h.store.setPreferences({ volume: 150 });
    h.update({ connection: 'ready' });
    await vi.advanceTimersByTimeAsync(20); expect(h.play).not.toHaveBeenCalled();
    const stop = h.bind(); expect(h.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    h.update({ audioBlocked: false });
    await vi.advanceTimersByTimeAsync(20);
    expect(h.play).toHaveBeenCalledExactlyOnceWith('ready', 1.5); stop();
  });

  it('never announces socket opening, registration, a taken line or a missing account', async () => {
    const h = harness(); const stop = h.bind();
    for (const patch of [{ connection: 'connecting' }, { connection: 'registering' }, { connection: 'ready', lineTaken: true }, { lineTaken: false, account: null }] as Partial<PhoneSnapshot>[]) {
      h.update(patch); await vi.advanceTimersByTimeAsync(20);
    }
    expect(h.play).not.toHaveBeenCalled(); stop();
  });

  it('cancels success if the workspace unmounts or the connection is lost before the frame', async () => {
    const h = harness(); h.update({ connection: 'ready' });
    const stop = h.bind(); stop();
    await vi.advanceTimersByTimeAsync(20); expect(h.play).not.toHaveBeenCalled();
    const again = h.bind(); h.update({ connection: 'network-error' });
    await vi.advanceTimersByTimeAsync(20); expect(h.play).not.toHaveBeenCalled(); again();
  });

  it('does not double-announce a StrictMode remount and signals a real reconnection once', async () => {
    const h = harness(); h.update({ connection: 'ready' });
    h.bind()(); const stop = h.bind();
    await vi.advanceTimersByTimeAsync(20);
    h.update({ connection: 'reconnecting' }); h.update({ connection: 'reconnecting' });
    h.update({ connection: 'registering' }); h.update({ connection: 'ready' });
    await vi.advanceTimersByTimeAsync(20);
    expect(h.play.mock.calls).toEqual([['ready', 1], ['lost', 1], ['ready', 1]]); stop();
  });

  it('respects sound settings at playback time', async () => {
    const h = harness(); const stop = h.bind();
    h.update({ connection: 'ready' }); h.store.setPreferences({ lineSounds: false });
    await vi.advanceTimersByTimeAsync(20);
    h.update({ connection: 'reconnecting' });
    expect(h.play).not.toHaveBeenCalled(); stop();
  });
});
