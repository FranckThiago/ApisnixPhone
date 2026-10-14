import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stream() {
  const track = { readyState: 'live', stop: vi.fn(() => { track.readyState = 'ended'; }) };
  return { getTracks: () => [track], getAudioTracks: () => [track] };
}
class Context {
  state = 'running';
  resume = vi.fn(async () => undefined);
  createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() });
  createMediaStreamDestination = () => ({ stream: stream(), disconnect: vi.fn() });
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
}

describe('microphone across consecutive calls', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream()) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([0, 50, 95, 100, 150, 200])('sends a fresh live track at %i %% after SIP.js stops the previous call track', async (gain) => {
    const { MicPipeline } = await import('../src/telephony/audio');
    const mic = new MicPipeline({ deviceId: 'usb', gain, echoCancellation: true, noiseSuppression: true });
    const first = await mic.open();
    first.getTracks().forEach(track => track.stop()); // SIP.js closes the peer connection.
    mic.close();
    const second = await mic.open();
    expect(second.getAudioTracks()[0]!.readyState).toBe('live');
    expect(second).not.toBe(first);
    // A late cleanup of the previous SIP session must not stop this call.
    first.getTracks().forEach(track => track.stop());
    expect(second.getAudioTracks()[0]!.readyState).toBe('live');
    mic.close();
    expect(second.getAudioTracks()[0]!.readyState).toBe('ended');
  });

  it('keeps direct capture at 100 % across calls and releases each microphone', async () => {
    const { MicPipeline } = await import('../src/telephony/audio');
    const mic = new MicPipeline({ deviceId: 'usb', gain: 100, echoCancellation: true, noiseSuppression: true });
    const first = await mic.open();
    mic.close();
    const second = await mic.open();
    expect(first.getAudioTracks()[0]!.readyState).toBe('ended');
    expect(second.getAudioTracks()[0]!.readyState).toBe('live');
    expect(second).toBe(await vi.mocked(navigator.mediaDevices.getUserMedia).mock.results[1]!.value);
    mic.close();
  });
  it.each([0, 95, 200])('ignores legacy gain %i even when Web Audio is unavailable', async gain => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Unavailable'); } });
    const { MicPipeline } = await import('../src/telephony/audio');
    const mic = new MicPipeline({ deviceId: 'default', gain, echoCancellation: true, noiseSuppression: true });
    const actual = await mic.open();
    expect(actual).toBe(await vi.mocked(navigator.mediaDevices.getUserMedia).mock.results[0]!.value);
    expect(actual.getAudioTracks()[0]!.readyState).toBe('live');
    mic.close();
  });

  it('releases a microphone that arrives after the test or call was closed', async () => {
    const input = stream();
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(done => { resolve = done; }));
    const { MicPipeline } = await import('../src/telephony/audio');
    const mic = new MicPipeline({ deviceId: 'default', echoCancellation: true, noiseSuppression: true });
    const opening = mic.open();
    mic.close();
    resolve(input as unknown as MediaStream);
    await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    expect(input.getAudioTracks()[0]!.readyState).toBe('ended');
  });

  it('observes the original track without sending it through the meter', async () => {
    const connect = vi.fn();
    const analyser = { fftSize: 512, disconnect: vi.fn(), getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.5) };
    vi.stubGlobal('AudioContext', class extends Context {
      createMediaStreamSource = () => ({ connect, disconnect: vi.fn() });
      createAnalyser = () => analyser;
    });
    const { MicPipeline } = await import('../src/telephony/audio');
    const mic = new MicPipeline({ deviceId: 'default', echoCancellation: true, noiseSuppression: true });
    const actual = await mic.open(true);
    expect(actual).toBe(await vi.mocked(navigator.mediaDevices.getUserMedia).mock.results[0]!.value);
    expect(connect).toHaveBeenCalledExactlyOnceWith(analyser);
    expect(mic.createMeter()?.()).toBe(0.5);
    mic.close();
    expect(analyser.disconnect).toHaveBeenCalledOnce();
  });

});
