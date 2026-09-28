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

  it.each([50, 150, 200])('sends a fresh live track at %i %% after SIP.js stops the previous call track', async (gain) => {
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
    expect(mic.bypassed).toBe(true);
    mic.close();
  });
});
