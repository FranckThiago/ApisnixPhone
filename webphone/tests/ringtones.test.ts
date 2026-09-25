import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RINGTONE, findRingtone, previewSeconds, type RingNote, RINGTONES, scheduleRingtone, soundLength } from '../src/telephony/ringtones';

/** The level a note's envelope reaches at time `t` of its cycle, as scheduled by `scheduleRingtone`. */
function envelopeAt(note: RingNote, t: number): number {
  const begin = note.at, end = note.at + note.length, peak = begin + (note.attack ?? 0.01);
  if (t < begin || t > end) return 0;
  if (t < peak) return note.level * (t - begin) / (peak - begin);
  const fadeFrom = note.release ? Math.max(peak, end - note.release) : peak;
  if (t <= fadeFrom) return note.level;
  return note.level * (0.0001 / note.level) ** ((t - fadeFrom) / (end - fadeFrom));
}

describe('ringtone library', () => {
  it('offers calm and loud ringtones under distinct names', () => {
    expect(new Set(RINGTONES.map(ringtone => ringtone.id)).size).toBe(RINGTONES.length);
    expect(RINGTONES.filter(ringtone => !ringtone.loud).length).toBeGreaterThanOrEqual(3);
    expect(RINGTONES.filter(ringtone => ringtone.loud).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the original ringtone as the default and for unknown choices', () => {
    expect(findRingtone(undefined).id).toBe(DEFAULT_RINGTONE);
    expect(findRingtone('retired-ringtone').id).toBe(DEFAULT_RINGTONE);
    expect(findRingtone('alarme').id).toBe('alarme');
    expect(findRingtone(DEFAULT_RINGTONE).loud).toBe(false);
  });

  it('makes loud ringtones bright and calm ones soft', () => {
    for (const ringtone of RINGTONES) {
      const bright = ringtone.notes.some(note => note.type === 'square' || note.type === 'sawtooth');
      expect(bright, ringtone.id).toBe(ringtone.loud);
    }
  });

  // The first levels proved too quiet in real use: every ringtone now uses almost the whole range.
  it('falls silent before the next cycle, rings loud and never distorts at full volume', () => {
    for (const ringtone of RINGTONES) {
      expect(soundLength(ringtone), ringtone.id).toBeLessThan(ringtone.period);
      let loudest = 0;
      for (let t = 0; t <= ringtone.period; t += 0.001) {
        loudest = Math.max(loudest, ringtone.notes.reduce((sum, note) => sum + envelopeAt(note, t), 0));
      }
      expect(loudest, ringtone.id).toBeLessThan(1);
      expect(loudest, ringtone.id).toBeGreaterThan(0.8);
    }
  });

  it('previews whole cycles for about three seconds', () => {
    for (const ringtone of RINGTONES) {
      const seconds = previewSeconds(ringtone);
      expect(seconds, ringtone.id).toBeGreaterThanOrEqual(2.5);
      expect(seconds, ringtone.id).toBeLessThanOrEqual(4.5);
      const cycles = (seconds - soundLength(ringtone)) / ringtone.period;
      expect(cycles, ringtone.id).toBeCloseTo(Math.round(cycles), 6);
    }
  });
});

class FakeParam {
  value = 1;
  events: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time: number) { this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push(['exponential', value, time]); }
  setTargetAtTime(value: number, time: number) { this.events.push(['target', value, time]); }
}

class FakeNode {
  connections: unknown[] = [];
  disconnected = false;
  constructor(readonly context: FakeContext) {}
  connect<T>(node: T) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
}

class FakeGain extends FakeNode { gain = new FakeParam(); }

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  window: [number, number] = [0, 0];
  start(time: number) { this.window[0] = time; }
  stop(time: number) { this.window[1] = time; }
}

class FakeContext {
  static last?: FakeContext;
  state = 'running';
  currentTime = 10;
  destination = new FakeNode(this);
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  constructor() { FakeContext.last = this; }
  resume() { return Promise.resolve(); }
  createOscillator() { const node = new FakeOscillator(this); this.oscillators.push(node); return node; }
  createGain() { const node = new FakeGain(this); this.gains.push(node); return node; }
}

describe('ringtone playback', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('schedules every note of a cycle on the given output', () => {
    const context = new FakeContext();
    const output = new FakeGain(context);
    const ringtone = findRingtone('alarme');
    scheduleRingtone(context as unknown as BaseAudioContext, output as unknown as AudioNode, 10, ringtone);
    expect(context.oscillators).toHaveLength(ringtone.notes.length);
    expect(context.oscillators.every(oscillator => oscillator.type === 'square' && oscillator.frequency.value === 1600)).toBe(true);
    expect(context.gains.every(envelope => envelope.connections[0] === output)).toBe(true);
    expect(Math.max(...context.oscillators.map(oscillator => oscillator.window[1]))).toBeLessThanOrEqual(10 + soundLength(ringtone) + 0.03);
  });

  it('repeats the chosen ringtone and silences it at once when stopped', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeContext);
    const { Ringer } = await import('../src/telephony/audio');
    const ringer = new Ringer();
    const ringtone = findRingtone('retro');
    ringer.start(0.5, 'retro');
    const context = FakeContext.last!;
    const output = context.gains[0]!;
    expect(output.gain.value).toBe(0.5);
    expect(context.oscillators).toHaveLength(ringtone.notes.length);
    vi.advanceTimersByTime(ringtone.period * 1000);
    expect(context.oscillators).toHaveLength(ringtone.notes.length * 2);

    ringer.stop();
    expect(output.gain.events.at(-1)?.slice(0, 2)).toEqual(['target', 0]);
    vi.advanceTimersByTime(ringtone.period * 3000);
    expect(output.disconnected).toBe(true);
    expect(context.oscillators).toHaveLength(ringtone.notes.length * 2);
  });
});
