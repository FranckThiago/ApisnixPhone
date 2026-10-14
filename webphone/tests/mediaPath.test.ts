import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaAccessClient, observeMedia, relayAvailable } from '../src/telephony/mediaPath';

const access = () => ({ enabled: true, account: 'test', expiresAt: Date.now() + 8 * 3600000, iceTransportPolicy: 'relay', csrf: 'test-csrf',
  iceServers: [{ urls: ['turn:relay.example:3478?transport=udp'], username: 'temporary', credential: 'fictional-test' }] });
afterEach(() => vi.useRealTimers());
describe('per-call media access', () => {
  it('shares an in-flight request and caches only settings for the current account', async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; }));
    const client = new MediaAccessClient('test', fetcher);
    const first = client.load(), second = client.load();
    resolve(Response.json(access()));
    expect(await first).toEqual(await second);
    expect((await client.load())?.iceTransportPolicy).toBe('relay');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const other = new MediaAccessClient('another-line', async () => Response.json(access()));
    expect(await other.load()).toBeUndefined();
  });
  it('falls back to the existing direct path if not enabled or HTTP unavailable', async () => {
    for (const fetcher of [async () => Response.json({enabled:false}), async () => new Response('',{status:401}), async () => { throw new Error('offline'); }]) {
      expect(await new MediaAccessClient('test', fetcher).load()).toBeUndefined();
    }
  });
  it('refreshes before expiry and never reuses expired credentials during an outage', async () => {
    vi.useFakeTimers(); const initial = access();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(initial)).mockRejectedValue(new Error('offline'));
    const client = new MediaAccessClient('test', fetcher);
    expect(await client.load()).toEqual(initial);
    vi.setSystemTime(Date.now() + 9 * 3600000);
    expect(await client.load()).toBeUndefined();
  });
  it('sends no credentials in technical reports and failure does not escape', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const client = new MediaAccessClient('test', fetcher);
    await expect(client.report(access() as never, {sentPackets:42})).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[1].body).toBe(JSON.stringify({account:'test',metrics:{sentPackets:42}}));
  });
  it('records counters and candidate types without network addresses, stops exactly once', async () => {
    vi.useFakeTimers();
    const stats = new Map([
      ['tx',{type:'outbound-rtp',kind:'audio',packetsSent:12}], ['rx',{type:'inbound-rtp',kind:'audio',packetsReceived:10,packetsLost:1}],
      ['transport',{type:'transport',selectedCandidatePairId:'pair'}], ['pair',{localCandidateId:'local',remoteCandidateId:'remote',currentRoundTripTime:.1}],
      ['local',{candidateType:'relay',protocol:'udp',address:'private-test-address'}], ['remote',{candidateType:'host',address:'private-test-peer'}],
    ]);
    const pc = Object.assign(new EventTarget(), {iceConnectionState:'connected',connectionState:'connected',getConfiguration: () => ({iceTransportPolicy:'relay'}),getStats:async () => stats});
    const send = vi.fn(); const observer = observeMedia(pc as unknown as RTCPeerConnection,'relay',send);
    observer.answered(); await vi.advanceTimersByTimeAsync(1000); observer.stop(); observer.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({localType:'relay',protocol:'udp',sentPackets:12,receivedPackets:10,rttMs:100});
    expect(JSON.stringify(send.mock.calls)).not.toContain('private-test');
  });
});

it('preflights a relay without changing an existing connection and always closes it', async () => {
  vi.useFakeTimers();
  const pc = Object.assign(new EventTarget(), { signalingState:'stable', createDataChannel:vi.fn(),
    createOffer:async () => ({type:'offer',sdp:'synthetic'}), setLocalDescription:vi.fn(async () => undefined),close:vi.fn() });
  const pending=relayAvailable([],() => pc as unknown as RTCPeerConnection);
  pc.dispatchEvent(Object.assign(new Event('icecandidate'),{candidate:{type:'relay'}}));
  expect(await pending).toBe(true);expect(pc.close).toHaveBeenCalledTimes(1);
});
it('bounds an unreachable relay and releases its socket', async () => {
  vi.useFakeTimers();
  const pc = Object.assign(new EventTarget(), { signalingState:'stable',createDataChannel:vi.fn(),
    createOffer:() => new Promise(() => undefined),close:vi.fn() });
  const pending=relayAvailable([],() => pc as unknown as RTCPeerConnection);
  await vi.advanceTimersByTimeAsync(1800);
  expect(await pending).toBe(false);expect(pc.close).toHaveBeenCalledTimes(1);
});
