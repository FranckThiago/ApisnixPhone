import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContext } from './fakeAudio';

interface FakeTrack { id: string; readyState: string }

/** The call's audio element as SIP.js drives it: a stream assigned, reloaded when a track arrives. */
function voiceElement() {
  const listeners = new Map<string, () => void>();
  const element = {
    volume: 1, muted: false, srcObject: null as unknown,
    addEventListener: (type: string, listener: () => void) => { listeners.set(type, listener); },
  };
  const play = (...tracks: FakeTrack[]) => {
    element.srcObject = { getAudioTracks: () => tracks };
    listeners.get('loadstart')?.();
  };
  return { element, play, asElement: element as unknown as HTMLAudioElement };
}

describe('far end voice', () => {
  beforeEach(() => { FakeContext.last = undefined; vi.stubGlobal('AudioContext', FakeContext); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('plays through the element as before up to 100 %, without any amplifier', async () => {
    const { RemoteVoice } = await import('../src/telephony/audio');
    const { element, play, asElement } = voiceElement();
    const voice = new RemoteVoice(asElement);
    play({ id: 'a', readyState: 'live' });
    voice.startCall();
    voice.setLevel(0.6);
    expect(element).toMatchObject({ volume: 0.6, muted: false });
    voice.setLevel(1);
    expect(element).toMatchObject({ volume: 1, muted: false });
    expect(FakeContext.last).toBeUndefined();
  });

  it('amplifies the call above 100 % behind a limiter, the element silenced but still playing', async () => {
    const { RemoteVoice } = await import('../src/telephony/audio');
    const { element, play, asElement } = voiceElement();
    const voice = new RemoteVoice(asElement);
    voice.setLevel(1.8);
    // Nothing to amplify before a call: the element keeps its full volume.
    expect(element).toMatchObject({ volume: 1, muted: false });
    play({ id: 'a', readyState: 'live' });
    voice.startCall();
    const context = FakeContext.last!;
    const [gain] = context.gains, [limiter] = context.compressors, [source] = context.sources;
    expect(element).toMatchObject({ volume: 1, muted: true });
    expect(gain!.gain.value).toBe(1.8);
    expect(source!.stream).toBe(element.srcObject);
    expect(source!.connections).toEqual([gain]);
    expect(gain!.connections).toEqual([limiter]);
    expect(limiter!.connections).toEqual([context.destination]);
    // Back to 100 %: the element speaks again, the amplifier falls silent.
    voice.setLevel(0.9);
    expect(element).toMatchObject({ volume: 0.9, muted: false });
    expect(gain!.gain.value).toBe(0);
    voice.setLevel(3);
    expect(gain!.gain.value).toBe(2);
  });

  it('follows a new track, stays silent during a hold renegotiation and lets go at the end of the call', async () => {
    const { RemoteVoice } = await import('../src/telephony/audio');
    const { element, play, asElement } = voiceElement();
    const voice = new RemoteVoice(asElement);
    voice.setLevel(1.5);
    play({ id: 'a', readyState: 'live' });
    voice.startCall();
    const context = FakeContext.last!;
    play({ id: 'b', readyState: 'live' });
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0]!.disconnected).toBe(true);
    voice.setQuiet(true);
    expect(element.muted).toBe(true);
    expect(context.gains[0]!.gain.value).toBe(0);
    voice.setQuiet(false);
    expect(context.gains[0]!.gain.value).toBe(1.5);
    voice.endCall();
    expect(context.sources[1]!.disconnected).toBe(true);
    expect(element).toMatchObject({ volume: 1, muted: false });
  });

  it('never loses the voice: asleep output or unreachable headset keep the element at full volume', async () => {
    const { RemoteVoice } = await import('../src/telephony/audio');
    const { element, play, asElement } = voiceElement();
    const voice = new RemoteVoice(asElement);
    voice.setLevel(2);
    play({ id: 'a', readyState: 'live' });
    const asleep = class extends FakeContext { state = 'suspended'; };
    vi.stubGlobal('AudioContext', asleep);
    voice.startCall();
    const context = FakeContext.last!;
    expect(element).toMatchObject({ volume: 1, muted: false });
    // A click wakes the output up: the amplifier takes over.
    context.state = 'running';
    context.listeners.get('statechange')!();
    expect(element.muted).toBe(true);
    // A headset this browser cannot send Web Audio to: back to the element, on that headset.
    await voice.setSink('headset-1');
    expect(element).toMatchObject({ volume: 1, muted: false });
  });

  it('sends the amplified voice to the chosen headset when the browser can', async () => {
    const { RemoteVoice } = await import('../src/telephony/audio');
    const sinks: string[] = [];
    vi.stubGlobal('AudioContext', class extends FakeContext { setSinkId(id: string) { sinks.push(id); return Promise.resolve(); } });
    const { element, play, asElement } = voiceElement();
    const voice = new RemoteVoice(asElement);
    voice.setLevel(1.4);
    play({ id: 'a', readyState: 'live' });
    voice.startCall();
    await voice.setSink('headset-1');
    expect(sinks).toEqual(['headset-1']);
    expect(element.muted).toBe(true);
    expect(FakeContext.last!.gains[0]!.gain.value).toBe(1.4);
  });
});
