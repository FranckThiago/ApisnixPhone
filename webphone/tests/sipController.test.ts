import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SipPhoneController, type ManagedSession, type Manager, type ManagerDelegate, type SipEnvironment } from '../src/telephony/SipPhoneController';

const session = (id: string, user = '', displayName = ''): ManagedSession => ({ id, remoteIdentity: { displayName, uri: { user } } });

function harness(lineFree = true) {
  let delegate!: ManagerDelegate;
  const released = vi.fn();
  let registerReject!: (status: number) => void;
  let invite!: { onProgress(): void; onReject(status: number): void };
  const manager = {
    connect: vi.fn(async () => delegate.onServerConnect()),
    disconnect: vi.fn(async () => undefined),
    register: vi.fn(async (options: Parameters<Manager['register']>[0]) => {
      registerReject = status => options.requestDelegate.onReject({ message: { statusCode: status } });
    }),
    unregister: vi.fn(async () => undefined),
    call: vi.fn(async (_destination: string, _options: undefined, options: Parameters<Manager['call']>[2]) => {
      invite = { onProgress: () => options.requestDelegate.onProgress({ message: {} }),
                 onReject: status => options.requestDelegate.onReject({ message: { statusCode: status } }) };
      delegate.onCallCreated(session('out'));
    }),
    answer: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    hangup: vi.fn(async () => undefined),
    hold: vi.fn(async () => undefined),
    unhold: vi.fn(async () => undefined),
    mute: vi.fn(),
    unmute: vi.fn(),
    sendDTMF: vi.fn(async () => undefined),
    dropSilently: vi.fn(async () => undefined),
  };
  const environment: SipEnvironment = {
    createManager: (_config, _credentials, given) => { delegate = given; return manager; },
    createRemoteAudio: () => undefined,
    acquireLine: async () => (lineFree ? released : null),
  };
  const phone = new SipPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example:8089/ws' }, environment);
  return { phone, manager, released, environment, get delegate() { return delegate; }, reject: (status: number) => registerReject(status), get invite() { return invite; } };
}

async function ready(h: ReturnType<typeof harness>) {
  await h.phone.connect({ username: 'alice', password: 'fictional' });
  h.delegate.onRegistered();
}

describe('SIP controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is ready only once registered, not when the socket opens', async () => {
    const h = harness();
    await h.phone.connect({ username: ' alice ', password: 'fictional' });
    expect(h.phone.getSnapshot().connection).toBe('registering');
    h.delegate.onRegistered();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', demo: false, account: { username: 'alice', domain: 'pbx.example' } });
    expect(JSON.stringify(h.phone.getSnapshot())).not.toContain('fictional');
  });

  it('stops after a refused registration and frees the line', async () => {
    const h = harness();
    await h.phone.connect({ username: 'alice', password: 'wrong' });
    h.reject(403);
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'auth-error', account: null });
    expect(h.manager.register).toHaveBeenCalledTimes(1);
    expect(h.released).toHaveBeenCalled();
  });

  it('does not register when another tab holds the line', async () => {
    const h = harness(false);
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    expect(h.phone.getSnapshot().connection).toBe('other-tab-active');
    expect(h.manager.connect).not.toHaveBeenCalled();
  });

  it('dials the exact digits once and counts talk time from the answer', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('+237 699 00 01 02', '+237699000102');
    h.phone.call('0600000000', '0600000000');
    expect(h.manager.call).toHaveBeenCalledTimes(1);
    expect(h.manager.call.mock.calls[0]![0]).toBe('sip:+237699000102@pbx.example');
    await vi.advanceTimersByTimeAsync(0);
    h.invite.onProgress();
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ringing-out', dialTarget: '+237699000102' });
    expect(h.phone.getSnapshot().call?.answeredAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    h.delegate.onCallAnswered(session('out'));
    const call = h.phone.getSnapshot().call!;
    expect(call.answeredAt! - call.startedAt).toBeGreaterThanOrEqual(5000);
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'answered' });
  });

  it('escapes only # and refuses anything that is not a number', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', 'bob@evil.example');
    expect(h.manager.call).not.toHaveBeenCalled();
    h.phone.call('*72#', '*72#');
    expect(h.manager.call.mock.calls[0]![0]).toBe('sip:*72%23@pbx.example');
  });

  it('maps refusals to outcomes; an outgoing call is never missed', async () => {
    for (const [status, outcome] of [[486, 'busy'], [480, 'no-answer'], [603, 'declined'], [503, 'failed']] as const) {
      const h = harness();
      await ready(h);
      h.phone.call('x', '+33100000001');
      await vi.advanceTimersByTimeAsync(0);
      h.invite.onReject(status);
      h.delegate.onCallHangup(session('out'));
      expect(h.phone.getSnapshot().call?.outcome).toBe(outcome);
    }
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.phone.hangup();
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call?.outcome).toBe('cancelled');
  });

  it('never answers by itself and keeps the remote identity as plain text', async () => {
    const h = harness();
    await ready(h);
    h.delegate.onCallReceived(session('in', '0612345678', '<img src=x onerror=alert(1)>'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(h.manager.answer).not.toHaveBeenCalled();
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ringing-in', dialTarget: '0612345678', remoteName: '<img src=x onerror=alert(1)>' });
    h.delegate.onCallHangup(session('in'));
    expect(h.phone.getSnapshot().call?.outcome).toBe('missed');
    h.phone.dismiss();
    h.delegate.onCallReceived(session('in2', '0612345678'));
    h.phone.decline();
    h.delegate.onCallHangup(session('in2'));
    expect(h.phone.getSnapshot().call?.outcome).toBe('declined');
  });

  it('shows hold only after the far end confirmed, and reports a refusal', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.phone.setHeld(true);
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'active', holdPending: true });
    h.delegate.onCallHold(session('out'), true);
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'held', holdPending: false });
    h.manager.unhold.mockRejectedValueOnce(new Error('488'));
    h.phone.setHeld(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'held', holdPending: false });
    expect(h.phone.getSnapshot().error).toMatch(/reprise/);
  });

  it('sends DTMF in order and mutes through the library', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    for (const tone of ['1', '2', '#', 'x']) h.phone.sendDtmf(tone);
    await vi.advanceTimersByTimeAsync(0);
    expect((h.manager.sendDTMF.mock.calls as unknown[][]).map(call => call[1])).toEqual(['1', '2', '#']);
    expect(h.phone.getSnapshot().call?.dtmf).toBe('12#');
    h.phone.setMuted(true);
    expect(h.manager.mute).toHaveBeenCalled();
    expect(h.phone.getSnapshot().call?.muted).toBe(true);
  });

  it('ends a dropped call without redialling and gives up reconnecting after the grace period', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.delegate.onServerDisconnect(new Error('lost'));
    // The conversation took place: it stays answered, with the reason it stopped.
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'reconnecting', call: { phase: 'ended', outcome: 'answered' } });
    expect(h.phone.getSnapshot().call?.failure).toMatch(/interrompu/);
    await vi.advanceTimersByTimeAsync(20000);
    expect(h.phone.getSnapshot().connection).toBe('network-error');
    expect(h.manager.call).toHaveBeenCalledTimes(1);
  });

  it('hangs up, unregisters and frees the line on disconnect', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    await h.phone.disconnect();
    expect(h.manager.hangup).toHaveBeenCalled();
    expect(h.manager.unregister).toHaveBeenCalled();
    expect(h.released).toHaveBeenCalled();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'offline', call: null, account: null });
  });
});

describe('SIP controller — microphone and shared line', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says why a call failed when the microphone is blocked', async () => {
    let microphone!: () => Promise<MediaStream>;
    const h = harness();
    const original = h.environment.createManager;
    h.environment.createManager = (config, credentials, delegate, mic, audio) => { microphone = mic; return original(config, credentials, delegate, mic, audio); };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    await microphone().catch(() => undefined);
    h.delegate.onCallHangup(session('out'));
    const snapshot = h.phone.getSnapshot();
    expect(snapshot.call).toMatchObject({ phase: 'ended', outcome: 'failed' });
    expect(snapshot.call?.failure).toMatch(/microphone est bloqué/i);
    expect(snapshot.error).toMatch(/microphone est bloqué/i);
    vi.unstubAllGlobals();
  });

  it('steps aside without un-registering when another device takes the line, and only retakes it on request', async () => {
    const h = harness();
    await ready(h);
    await vi.advanceTimersByTimeAsync(600_000);
    // No check ever seen: the PBX may not check this browser at all, never guess.
    expect(h.phone.getSnapshot().lineTaken).toBeFalsy();
    // A single check is enough: a device replaced seconds after signing in never sees a second one.
    h.delegate.onServerPing();
    await vi.advanceTimersByTimeAsync(110_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', lineTaken: false });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'other-tab-active', lineTaken: true, account: { username: 'alice' } });
    expect(h.manager.dropSilently).toHaveBeenCalledTimes(1);
    // An un-REGISTER would disconnect the device that now holds the line.
    expect(h.manager.unregister).not.toHaveBeenCalled();
    // No tug of war: nothing happens until the person asks.
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(h.manager.register).toHaveBeenCalledTimes(1);
    h.phone.retakeLine();
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onRegistered();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', lineTaken: false });
    expect(h.manager.register).toHaveBeenCalledTimes(2);
  });

  it('never steps aside in the middle of a conversation', async () => {
    const h = harness();
    await ready(h);
    h.delegate.onServerPing();
    await vi.advanceTimersByTimeAsync(60_000);
    h.delegate.onServerPing();
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    await vi.advanceTimersByTimeAsync(400_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', call: { phase: 'active' } });
    h.delegate.onCallHangup(session('out'));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.phone.getSnapshot().lineTaken).toBe(true);
  });

  it('gives up waiting for a hold confirmation that never comes', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.phone.setHeld(true);
    await vi.advanceTimersByTimeAsync(9000);
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'active', holdPending: false });
    expect(h.phone.getSnapshot().error).toMatch(/confirmé/);
  });
});

describe('sign-in', () => {
  it('resolves connect() before the registration is accepted: callers must wait for the final state', async () => {
    const h = harness();
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    // This is the state a first click used to act upon.
    expect(h.phone.getSnapshot().connection).toBe('registering');
    const settled = new Promise<string>(resolve => {
      const stop = h.phone.subscribe(() => {
        const state = h.phone.getSnapshot().connection;
        if (state !== 'connecting' && state !== 'registering') { stop(); resolve(state); }
      });
    });
    h.delegate.onRegistered();
    expect(await settled).toBe('ready');
  });
});
