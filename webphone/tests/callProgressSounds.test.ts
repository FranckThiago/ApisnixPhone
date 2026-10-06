import { afterEach, expect, it, vi } from 'vitest';
import { FakeContext } from './fakeAudio';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

it('makes ringing and answer cues louder while retaining silence, volume scaling and the limiter', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeContext);
  const { CallProgressSounds } = await import('../src/telephony/audio');
  const sounds = new CallProgressSounds();
  sounds.startRingback(1);
  const context = FakeContext.last!;
  const peaks = () => context.gains.map(g => Math.max(0, ...g.gain.events.map(([, v]) => v)));
  expect(Math.max(...peaks())).toBeGreaterThan(0.2);
  expect(context.oscillators).toHaveLength(2);
  vi.advanceTimersByTime(2600);
  expect(context.oscillators).toHaveLength(4);
  sounds.answered(2);
  expect(context.oscillators).toHaveLength(7);
  const answerPeakSum = peaks().slice(-3).reduce((a, b) => a + b, 0);
  expect(answerPeakSum).toBeGreaterThan(0.9);
  expect(answerPeakSum).toBeLessThan(1);
  expect(context.gains.every(g => context.compressors.includes(g.connections[0] as never))).toBe(true);
  vi.advanceTimersByTime(6000);
  expect(context.oscillators).toHaveLength(7);
  sounds.startRingback(0);
  sounds.answered(0);
  expect(context.oscillators).toHaveLength(7);
});
