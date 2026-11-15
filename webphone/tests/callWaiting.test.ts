import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallWaitingPhoneController, PilotMicrophone } from '../src/telephony/CallWaitingPhoneController';
import type { ManagedSession, ManagerDelegate, SipEnvironment } from '../src/telephony/SipPhoneController';

const session = (id: string): ManagedSession => ({ id, remoteIdentity: { uri: { user: id } } });
const tick = () => vi.advanceTimersByTimeAsync(0);
function harness(lines = ['pilot'], maxLines = 2) {
  let delegate!: ManagerDelegate;
  const events: string[] = [];
  const manager = {
    contactName: 'local', isConnected: () => true,
    connect: vi.fn(async () => delegate.onServerConnect()),
    register: vi.fn(async () => delegate.onRegistered()),
    unregister: vi.fn(async () => undefined), disconnect: vi.fn(async () => undefined), dropSilently: vi.fn(async () => undefined),
    holdsLine: vi.fn(async () => true), sentAudioPackets: vi.fn(async () => 250),
    call: vi.fn(async () => { delegate.onCallCreated(session('out')); }),
    setConference: vi.fn((sessions?: ManagedSession[], muted?: boolean) => { events.push(sessions ? `mix:${sessions.map(x => x.id).join('+')}:${muted ? 'muted' : 'open'}` : 'mix:off'); }),
    attendedTransfer: vi.fn(async (a: ManagedSession, b: ManagedSession) => { events.push(`refer:${a.id}>${b.id}`); }),
    answer: vi.fn(async (s: ManagedSession) => { events.push(`answer:${s.id}`); delegate.onCallAnswered(s); }),
    decline: vi.fn(async (s: ManagedSession) => { events.push(`decline:${s.id}`); delegate.onCallHangup(s); }),
    hangup: vi.fn(async (s: ManagedSession) => { events.push(`hangup:${s.id}`); delegate.onCallHangup(s); }),
    hold: vi.fn(async (s: ManagedSession) => { events.push(`hold:${s.id}`); }),
    unhold: vi.fn(async (s: ManagedSession) => { events.push(`unhold:${s.id}`); delegate.onCallHold(s, false); }),
    mute: vi.fn(), unmute: vi.fn(), sendDTMF: vi.fn(async () => undefined), focusSession: vi.fn(),
  };
  const environment: SipEnvironment = {
    createRemoteAudio: () => undefined,
    createManager: vi.fn((_config, _credentials, given) => { delegate = given; return manager; }),
  };
  const phone = new CallWaitingPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example/ws', callWaitingLines: lines, maxLines }, environment);
  const incoming = (id: string) => { if (!delegate.canReceiveCall()) return false; const s = session(id); delegate.onCallCreated(s); delegate.onCallReceived(s); return true; };
  return { phone, manager, environment, events, incoming, get delegate() { return delegate; } };
}
type Harness = ReturnType<typeof harness>;
async function ready(h: Harness, user = 'pilot') { await h.phone.connect({ username: user, password: 'fictional' }); }
async function pair(h: Harness) {
  await ready(h); expect(h.incoming('A')).toBe(true); h.phone.answer(); await tick(); expect(h.incoming('B')).toBe(true);
}
async function answerB(h: Harness) { h.phone.answerWaiting(); h.delegate.onCallHold(session('A'), true); await tick(); }

describe('two-call account-scoped pilot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each([{ lines: [] }, { lines: ['someone-else'] }])('keeps one session for accounts outside the pilot %j', async ({ lines }) => {
    const h = harness(lines); await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    expect(h.incoming('B')).toBe(false); expect(h.phone.getSnapshot().otherCall).toBeUndefined();
    expect(h.environment.createManager).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.environment.createManager).mock.calls[0]![0].maxCalls).toBeUndefined();
  });
  it('registers once, holds A before answering B, keeps both identities and rejects a third call', async () => {
    const h = harness(); await pair(h);
    expect(h.environment.createManager).toHaveBeenCalledTimes(1); expect(h.manager.register).toHaveBeenCalledTimes(1);
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, otherCall: { id: 'B', phase: 'ringing-in' } });
    expect(h.incoming('C')).toBe(false);
    h.phone.answerWaiting(); await tick();
    expect(h.events).toEqual(['answer:A', 'hold:A']);
    expect(h.phone.getSnapshot().switchingCall).toBe(true);
    h.phone.answerWaiting(); h.phone.switchCall(); h.phone.setMuted(true); h.phone.sendDtmf('1');
    expect(h.manager.hold).toHaveBeenCalledTimes(1); expect(h.manager.mute).not.toHaveBeenCalled(); expect(h.manager.sendDTMF).not.toHaveBeenCalled();
    h.delegate.onCallHold(session('A'), true); await tick();
    expect(h.events).toEqual(['answer:A', 'hold:A', 'answer:B']);
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'B', phase: 'active' }, otherCall: { id: 'A', phase: 'held' }, switchingCall: false });
    expect(h.manager.focusSession).toHaveBeenLastCalledWith(session('B'));
    h.phone.setMuted(true); h.phone.sendDtmf('2'); await tick();
    expect(h.manager.mute).toHaveBeenLastCalledWith(session('B')); expect(h.manager.sendDTMF).toHaveBeenLastCalledWith(session('B'), '2');
    h.phone.switchCall(); await tick(); expect(h.events.at(-1)).toBe('hold:B');
    h.delegate.onCallHold(session('B'), true); await tick();
    expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, otherCall: { id: 'B', phase: 'held', muted: true } });
  });
  it.each(['rejected', 'timeout', 'not-held'])('never answers B if hold is %s', async mode => {
    const h = harness(); await pair(h);
    if (mode === 'rejected') h.manager.hold.mockRejectedValueOnce(new Error('hold refused'));
    h.phone.answerWaiting();
    if (mode === 'not-held') h.delegate.onCallHold(session('A'), false);
    await vi.advanceTimersByTimeAsync(mode === 'timeout' ? 9000 : 0);
    expect(h.events).not.toContain('answer:B');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, otherCall: { id: 'B', phase: 'ringing-in' }, switchingCall: false });
    expect(h.phone.getSnapshot().error).toBeTruthy();
  });
  it('restores A if B cancels while hold is being negotiated', async () => {
    const h = harness(); await pair(h); h.phone.answerWaiting(); h.delegate.onCallHangup(session('B'));
    h.delegate.onCallHold(session('A'), true); await tick();
    expect(h.events).not.toContain('answer:B'); expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, switchingCall: false });
    expect(h.phone.getSnapshot().otherCall).toBeUndefined();
    expect(h.phone.getSnapshot().completedCalls).toEqual([expect.objectContaining({ id: 'B', outcome: 'missed' })]);
  });
  it('declines a waiting call without touching A or its audio focus', async () => {
    const h = harness(); await pair(h); h.phone.declineWaiting(); await tick();
    expect(h.events).toEqual(['answer:A', 'decline:B']); expect(h.manager.focusSession).toHaveBeenLastCalledWith(session('A'));
    expect(h.phone.getSnapshot().call?.phase).toBe('active'); expect(h.phone.getSnapshot().otherCall).toBeUndefined();
  });
  it('terminates a failed B answer and resumes A', async () => {
    const h = harness(); await pair(h); h.manager.answer.mockRejectedValueOnce(new Error('answer refused'));
    await answerB(h);
    expect(h.events).toContain('decline:B'); expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, switchingCall: false });
  });
  it('automatically resumes held A when B ends and journals both exactly once', async () => {
    const h = harness(); await pair(h); await answerB(h);
    h.phone.hangup(); await tick();
    expect(h.events).toContain('hangup:B'); expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' } });
    h.delegate.onCallHangup(session('A')); h.delegate.onCallHangup(session('B')); await tick();
    expect(h.phone.getSnapshot().completedCalls?.map(c => c.id)).toEqual(['B', 'A']);
    expect(h.phone.getSnapshot().completedCalls?.every(c => c.outcome === 'answered')).toBe(true);
  });
  it('keeps B and its registration when held A ends in the background', async () => {
    const h = harness(); await pair(h); await answerB(h); h.delegate.onCallHangup(session('A')); await tick();
    await h.phone.checkConnection(); h.delegate.onLineTaken?.(); await tick();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', call: { id: 'B', phase: 'active' } });
    expect(h.manager.dropSilently).not.toHaveBeenCalled(); expect(h.manager.holdsLine).not.toHaveBeenCalled();
    expect(h.manager.focusSession).toHaveBeenLastCalledWith(session('B'));
  });
  it('allows A to end during hold negotiation then answers B alone', async () => {
    const h = harness(); await pair(h); h.phone.answerWaiting(); h.delegate.onCallHangup(session('A')); await tick();
    expect(h.events).toContain('answer:B'); expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'B', phase: 'active' }, switchingCall: false });
  });
  it('does not answer B after the user ends A during a transition', async () => {
    const h = harness(); await pair(h); h.phone.answerWaiting(); h.phone.hangup(); await tick();
    expect(h.events).not.toContain('answer:B'); expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'B', phase: 'ringing-in' }, switchingCall: false });
  });
  it('rejects arrivals during dialing, ringing and hold negotiation', async () => {
    const h = harness(); await ready(h); h.phone.call('1001', '1001'); expect(h.incoming('B')).toBe(false);
    h.delegate.onCallAnswered(session('out')); await tick(); h.phone.setHeld(true); expect(h.incoming('B')).toBe(false);
    h.delegate.onCallHold(session('out'), true); expect(h.incoming('B')).toBe(true);
  });
  it('cancels a second answer still being established and resumes A', async () => {
    const h = harness(); await pair(h); h.manager.answer.mockImplementationOnce(async () => undefined);
    await answerB(h); expect(h.phone.getSnapshot().switchingCall).toBe(true);
    h.phone.hangup(); await tick();
    expect(h.events).toContain('decline:B'); expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, switchingCall: false });
  });
  it('uses the freed first slot for a new waiting call while B continues', async () => {
    const h = harness(); await pair(h); await answerB(h); h.delegate.onCallHangup(session('A')); await tick();
    expect(h.incoming('C')).toBe(true);
    h.phone.answerWaiting(); h.delegate.onCallHold(session('B'), true); await tick();
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'C', phase: 'active' }, otherCall: { id: 'B', phase: 'held' } });
    expect(h.events.at(-1)).toBe('answer:C');
  });
  it('ignores old connection callbacks after logout and a new login', async () => {
    const h = harness(); await pair(h); const old = h.delegate;
    await h.phone.disconnect(); await ready(h); h.incoming('new'); h.phone.answer(); await tick();
    old.onServerDisconnect(); old.onCallHangup(session('new')); old.onUnregistered();
    expect(old.canReceiveCall()).toBe(false);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', call: { id: 'new', phase: 'active' } });
  });
  it('does not resume a held call while logging out', async () => {
    const h = harness(); await pair(h); await answerB(h); await h.phone.disconnect(); await tick();
    expect(h.manager.unhold).not.toHaveBeenCalled();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'offline', call: null });
  });
  it('ends both calls on network loss and leaves no active media focus', async () => {
    const h = harness(); await pair(h); await answerB(h); h.delegate.onServerDisconnect(new Error('offline')); await tick();
    expect(h.phone.getSnapshot().call?.phase).toBe('ended'); expect(h.phone.getSnapshot().otherCall).toBeUndefined();
    expect(h.phone.getSnapshot().completedCalls).toHaveLength(2); expect(h.manager.focusSession).toHaveBeenLastCalledWith(undefined);
  });
});

function stream(): MediaStream {
  const track = { enabled: true, readyState: 'live', stop: vi.fn(() => { track.readyState = 'ended'; }) };
  return { getTracks: () => [track], getAudioTracks: () => [track], clone: () => stream() } as unknown as MediaStream;
}
describe('isolated microphone legs', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('captures once, clones for both legs, and keeps B alive when A is muted/stopped', async () => {
    const source = stream(), getUserMedia = vi.fn(async () => source);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const mic = new PilotMicrophone(); const [a, b] = await Promise.all([mic.clone(), mic.clone()]);
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(a).not.toBe(b); expect(a).not.toBe(source);
    a.getAudioTracks()[0]!.enabled = false; a.getTracks().forEach(t => t.stop());
    expect(b.getAudioTracks()[0]!.enabled).toBe(true); expect(b.getAudioTracks()[0]!.readyState).toBe('live');
    mic.close(); expect(source.getAudioTracks()[0]!.readyState).toBe('ended');
  });
  it('does not reuse a late capture from a cancelled generation', async () => {
    let done!: (s: MediaStream) => void;
    const source = stream(), next = stream();
    const getUserMedia = vi.fn().mockImplementationOnce(() => new Promise<MediaStream>(r => { done = r; })).mockResolvedValue(next);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const mic = new PilotMicrophone(); const late = mic.clone(); const rejection = expect(late).rejects.toMatchObject({ name: 'AbortError' });
    mic.close(); const current = await mic.clone(); done(source); await rejection;
    const third = await mic.clone(); expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(current.getAudioTracks()[0]!.readyState).toBe('live'); expect(third.getAudioTracks()[0]!.readyState).toBe('live');
    mic.close();
  });
});

describe('five-line account', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const five = () => harness(['pilot'], 5);
  it('lets four more calls ring behind a conversation and refuses a sixth', async () => {
    const h = five(); await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    for (const id of ['B', 'C', 'D', 'E']) expect(h.incoming(id)).toBe(true);
    expect(h.incoming('F')).toBe(false);
    expect(h.phone.getSnapshot().call).toMatchObject({ id: 'A', phase: 'active' });
    expect(h.phone.getSnapshot().otherCalls?.map(c => [c.id, c.phase])).toEqual([['B', 'ringing-in'], ['C', 'ringing-in'], ['D', 'ringing-in'], ['E', 'ringing-in']]);
    expect(vi.mocked(h.environment.createManager).mock.calls[0]![0].maxCalls).toBe(5);
    expect(h.manager.register).toHaveBeenCalledTimes(1);
  });
  it('answers the chosen ringing call by id and declines another without touching the rest', async () => {
    const h = five(); await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    h.incoming('B'); h.incoming('C'); h.incoming('D');
    h.phone.declineWaiting('C'); await tick();
    h.phone.answerWaiting('D'); h.delegate.onCallHold(session('A'), true); await tick();
    expect(h.events).toEqual(['answer:A', 'decline:C', 'hold:A', 'answer:D']);
    expect(h.phone.getSnapshot().call).toMatchObject({ id: 'D', phase: 'active' });
    expect(h.phone.getSnapshot().otherCalls?.map(c => [c.id, c.phase])).toEqual([['A', 'held'], ['B', 'ringing-in']]);
    h.phone.switchCall('A'); h.delegate.onCallHold(session('D'), true); await tick();
    expect(h.phone.getSnapshot().call).toMatchObject({ id: 'A', phase: 'active' });
  });
  it('resumes a held conversation, not a ringing call, when the current one ends', async () => {
    const h = five(); await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    h.incoming('B'); h.phone.answerWaiting('B'); h.delegate.onCallHold(session('A'), true); await tick();
    h.incoming('C');
    h.phone.hangup(); await tick();
    expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot().call).toMatchObject({ id: 'A' });
    expect(h.phone.getSnapshot().otherCalls?.map(c => c.id)).toEqual(['C']);
  });
  async function consult(h: Harness) {
    await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    const placing = h.phone.callSecond('1002', '1002', 'Camille');
    await tick(); h.delegate.onCallHold(session('A'), true); await tick(); await placing; await tick();
  }
  it('holds the conversation before placing the second call on a free line', async () => {
    const h = five(); await consult(h);
    expect(h.events).toEqual(['answer:A', 'hold:A']);
    expect(h.manager.call).toHaveBeenCalledTimes(1);
    expect((h.manager.call.mock.calls[0] as unknown[])[0]).toBe('sip:1002@pbx.example');
    expect(h.phone.getSnapshot().call).toMatchObject({ direction: 'outbound', dialTarget: '1002' });
    expect(h.phone.getSnapshot().otherCalls?.map(c => [c.id, c.phase])).toEqual([['A', 'held']]);
  });
  it('never places the second call if the hold is not confirmed', async () => {
    const h = five(); await ready(h); h.incoming('A'); h.phone.answer(); await tick();
    h.manager.hold.mockRejectedValueOnce(new Error('hold refused'));
    await h.phone.callSecond('1002', '1002'); await tick();
    expect(h.manager.call).not.toHaveBeenCalled();
    expect(h.phone.getSnapshot()).toMatchObject({ call: { id: 'A', phase: 'active' }, switchingCall: false });
    expect(h.phone.getSnapshot().error).toBeTruthy();
  });
  it('hangs up the third party only and gives the conversation back', async () => {
    const h = five(); await consult(h); h.delegate.onCallAnswered(session('out')); await tick();
    h.phone.hangupSecond(); await tick();
    expect(h.events).toContain('hangup:out'); expect(h.events.at(-1)).toBe('unhold:A');
    expect(h.phone.getSnapshot().call).toMatchObject({ id: 'A', phase: 'active' });
    expect(h.phone.getSnapshot().otherCalls).toEqual([]);
  });
  it('bridges both parties with a confirmed transfer, then leaves both dialogs', async () => {
    const h = five(); await consult(h);
    await expect(h.phone.completeTransfer()).rejects.toThrow();
    h.delegate.onCallAnswered(session('out')); await tick();
    await h.phone.completeTransfer(); await tick();
    expect(h.events).toContain('refer:A>out');
    expect(h.events.filter(e => e.startsWith('hangup:')).sort()).toEqual(['hangup:A', 'hangup:out']);
    expect(h.phone.getSnapshot().otherCalls).toEqual([]);
  });
  it('keeps both calls when the transfer is refused', async () => {
    const h = five(); await consult(h); h.delegate.onCallAnswered(session('out')); await tick();
    h.manager.attendedTransfer.mockRejectedValueOnce(new Error('refused'));
    await expect(h.phone.completeTransfer()).rejects.toThrow();
    expect(h.events.some(e => e.startsWith('hangup:'))).toBe(false);
    expect(h.phone.getSnapshot()).toMatchObject({ call: { phase: 'active' }, switchingCall: false });
    expect(h.phone.getSnapshot().otherCalls?.map(c => c.id)).toEqual(['A']);
  });
  it('mixes both calls only after the held party is back, and mutes the microphone alone', async () => {
    const h = five(); await consult(h);
    await expect(h.phone.startConference()).rejects.toThrow();
    h.delegate.onCallAnswered(session('out')); await tick();
    await h.phone.startConference(); await tick();
    expect(h.events.slice(-2)).toEqual(['unhold:A', 'mix:A+out:open']);
    expect(h.phone.getSnapshot()).toMatchObject({ conference: true, consulting: true, switchingCall: false });
    h.phone.setMuted(true); h.phone.setHeld(true); await tick();
    expect(h.events.at(-1)).toBe('mix:A+out:muted');
    expect(h.manager.mute).not.toHaveBeenCalled(); expect(h.events.filter(e => e.startsWith('hold:'))).toEqual(['hold:A']);
    expect(h.phone.getSnapshot().call?.muted).toBe(true);
  });
  it('ends the mix when one party leaves and keeps the other call', async () => {
    const h = five(); await consult(h); h.delegate.onCallAnswered(session('out')); await tick();
    await h.phone.startConference(); await tick();
    h.delegate.onCallHangup(session('out')); await tick();
    expect(h.events).toContain('mix:off');
    expect(h.phone.getSnapshot()).toMatchObject({ conference: false, call: { id: 'A', phase: 'active' } });
  });
  it('leaves the conference by bridging both parties', async () => {
    const h = five(); await consult(h); h.delegate.onCallAnswered(session('out')); await tick();
    await h.phone.startConference(); await tick();
    await h.phone.completeTransfer(); await tick();
    expect(h.events).toContain('refer:A>out');
    expect(h.phone.getSnapshot().conference).toBe(false);
  });
  it('hangs up both calls at once', async () => {
    const h = five(); await consult(h); h.delegate.onCallAnswered(session('out')); await tick();
    h.incoming('Z');
    h.phone.hangupAll(); await tick();
    expect(h.events.slice(-3).sort()).toEqual(['decline:Z', 'hangup:A', 'hangup:out']);
  });
});
