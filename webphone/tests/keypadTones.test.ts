import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContext } from './fakeAudio';

describe('keypad tones', () => {
  beforeEach(() => { vi.stubGlobal('AudioContext', FakeContext); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('gives every key of the pad its own pair of telephone tones', async () => {
    const { DTMF_FREQUENCIES } = await import('../src/telephony/audio');
    expect(Object.keys(DTMF_FREQUENCIES).sort()).toEqual(['#', '*', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(new Set(Object.values(DTMF_FREQUENCIES).map(pair => pair.join('/'))).size).toBe(12);
    expect(DTMF_FREQUENCIES['5']).toEqual([770, 1336]);
  });

  it('plays a short dual tone for a key, and nothing otherwise', async () => {
    const { keypadTone } = await import('../src/telephony/audio');
    keypadTone('5', 0.5);
    const context = FakeContext.last!;
    expect(context.oscillators.map(oscillator => oscillator.frequency.value)).toEqual([770, 1336]);
    expect(context.oscillators.every(oscillator => oscillator.window[1] - oscillator.window[0] <= 0.2)).toBe(true);
    expect(Math.max(...context.gains.flatMap(envelope => envelope.gain.events.map(([, value]) => value)))).toBeCloseTo(0.12);

    keypadTone('+', 0.5);
    keypadTone('9', 0);
    expect(context.oscillators).toHaveLength(2);
  });
});
