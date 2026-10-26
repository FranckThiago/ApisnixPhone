import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../src/i18n';
import { SipPhoneController, type ManagedSession, type Manager, type ManagerDelegate, type SipEnvironment } from '../src/telephony/SipPhoneController';
import type { CallProgressSoundPlayer } from '../src/telephony/audio';

const session = (id: string, user = '', displayName = ''): ManagedSession => ({ id, remoteIdentity: { displayName, uri: { user } } });

function harness(remoteAudio?: HTMLAudioElement) {
  let delegate!: ManagerDelegate;
  let registerReject!: (status: number) => void;
  let invite!: { onProgress(response?: { message: { statusCode?: number; body?: string } }): void; onReject(status: number, reasonPhrase?: string, reasonHeader?: string): void };
  const manager = {
    contactName: 'test-browser',
    connect: vi.fn(async () => delegate.onServerConnect()),
    isConnected: vi.fn(() => true),
    disconnect: vi.fn(async () => undefined),
    register: vi.fn(async (options: Parameters<Manager['register']>[0]) => {
      registerReject = status => options.requestDelegate.onReject({ message: { statusCode: status } });
    }),
    unregister: vi.fn(async () => undefined),
    call: vi.fn(async (_destination: string, _options: undefined, options: Parameters<Manager['call']>[2]) => {
      invite = { onProgress: (response = { message: {} }) => options.requestDelegate.onProgress(response),
                 onReject: (status, reasonPhrase, reasonHeader) => options.requestDelegate.onReject({ message: { statusCode: status, reasonPhrase, getHeader: name => name === 'Reason' ? reasonHeader : undefined } }) };
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
    holdsLine: vi.fn(async (): Promise<boolean | 'missing' | null> => true),
    sentAudioPackets: vi.fn(async (): Promise<number | null> => 250),
  };
  const environment: SipEnvironment = {
    createManager: (_config, _credentials, given) => { delegate = given; return manager; },
    createRemoteAudio: () => remoteAudio,
  };
  const callProgress: CallProgressSoundPlayer = {
    startRingback: vi.fn(), answered: vi.fn(), stop: vi.fn(),
  };
  const phone = new SipPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example:8089/ws', statusUrl: 'https://pbx.example/etat' }, environment, callProgress);
  return { phone, manager, environment, callProgress, get delegate() { return delegate; }, reject: (status: number) => registerReject(status), get invite() { return invite; } };
}

async function ready(h: ReturnType<typeof harness>) {
  await h.phone.connect({ username: 'alice', password: 'fictional' });
  h.delegate.onRegistered();
}

/** A remote <audio> as SIP.js drives it: the far end's stream is attached on the 183, its track unmutes on the first packets. */
function fakeRemoteAudio() {
  const track = Object.assign(new EventTarget(), { muted: true, readyState: 'live' }) as unknown as MediaStreamTrack;
  const element = Object.assign(new EventTarget(), { srcObject: null as MediaStream | null, volume: 1, muted: false, paused: false,
    play: vi.fn(async () => undefined), load: vi.fn(), setAttribute: vi.fn() }) as unknown as HTMLAudioElement & { srcObject: MediaStream | null };
  const attach = () => { element.srcObject = { getAudioTracks: () => [track] } as unknown as MediaStream; element.dispatchEvent(new Event('loadstart')); };
  const unmute = () => { (track as { muted: boolean }).muted = false; track.dispatchEvent(new Event('unmute')); };
  return { element, attach, unmute };
}

describe('early media chosen by the server for this line', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('passes the choice of the media preparation to the invitation, and nothing otherwise', async () => {
    const h = harness(); await ready(h);
    Object.assign(h.manager, { prepareMedia: async () => ({ earlyMedia: true }) });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    expect(h.manager.call.mock.calls[0]![1]).toEqual({ earlyMedia: true });
    // An unanswered outbound call ends on a microtask (the INVITE's final status is awaited first).
    h.delegate.onCallHangup(session('out')); await vi.advanceTimersByTimeAsync(0); h.phone.dismiss();
    Object.assign(h.manager, { prepareMedia: async () => ({ earlyMedia: false }) });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    expect(h.manager.call.mock.calls[1]![1]).toBeUndefined();
    h.delegate.onCallHangup(session('out')); await vi.advanceTimersByTimeAsync(0); h.phone.dismiss();
    Object.assign(h.manager, { prepareMedia: async () => undefined });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    expect(h.manager.call.mock.calls[2]![1]).toBeUndefined();
  });
  it.each(['before-progress', 'after-progress'] as const)('stops ringback for an already unmuted stream attached %s', async timing => {
    const remote = fakeRemoteAudio();
    const h = harness(remote.element); await ready(h);
    Object.assign(h.manager, { prepareMedia: async () => ({ earlyMedia: true }) });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    remote.unmute();
    if (timing === 'before-progress') remote.attach();
    h.invite.onProgress({ message: { statusCode: 183, body: 'v=0 fictional sdp' } });
    if (timing === 'after-progress') remote.attach();
    expect(h.callProgress.stop).toHaveBeenCalledTimes(1);
    remote.attach(); remote.unmute();
    expect(h.callProgress.stop).toHaveBeenCalledTimes(1);
    h.phone.applyAudio({ volume: 50, micGain: 100, ringtone: true, ringtoneSound: 'classic', echoCancellation: true, noiseSuppression: true });
    expect(h.callProgress.startRingback).toHaveBeenCalledTimes(1);
  });
  it('keeps our ringback until the remote media is available, then leaves the line to it', async () => {
    const remote = fakeRemoteAudio();
    const h = harness(remote.element); await ready(h);
    Object.assign(h.manager, { prepareMedia: async () => ({ earlyMedia: true }) });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    remote.attach();
    h.invite.onProgress({ message: { statusCode: 183, body: 'v=0 fictional sdp' } });
    expect(h.phone.getSnapshot().call?.phase).toBe('ringing-out');
    expect(h.callProgress.startRingback).toHaveBeenCalledTimes(1);
    expect(h.callProgress.stop).not.toHaveBeenCalled();
    h.invite.onProgress({ message: { statusCode: 180 } });
    expect(h.callProgress.startRingback).toHaveBeenCalledTimes(1);
    remote.unmute();
    expect(h.callProgress.stop).toHaveBeenCalledTimes(1);
    h.phone.applyAudio({ volume: 50, micGain: 100, ringtone: true, ringtoneSound: 'classic', echoCancellation: true, noiseSuppression: true });
    expect(h.callProgress.startRingback).toHaveBeenCalledTimes(1);
    h.delegate.onCallAnswered(session('out'));
    expect(h.callProgress.answered).toHaveBeenCalledWith(0.5);
    h.delegate.onCallHangup(session('out')); h.phone.dismiss();
    // The next call starts afresh with our own ringback.
    h.phone.call('x', '+33100000002'); await vi.advanceTimersByTimeAsync(0);
    h.invite.onProgress({ message: { statusCode: 180 } });
    expect(h.callProgress.startRingback).toHaveBeenCalledTimes(2);
  });
  it('ignores a provisional response without SDP and a line without early media', async () => {
    const remote = fakeRemoteAudio();
    const h = harness(remote.element); await ready(h);
    Object.assign(h.manager, { prepareMedia: async () => ({ earlyMedia: true }) });
    h.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    remote.attach();
    h.invite.onProgress({ message: { statusCode: 180 } });
    remote.unmute();
    expect(h.callProgress.stop).not.toHaveBeenCalled();
    h.delegate.onCallHangup(session('out'));
    const direct = fakeRemoteAudio();
    const d = harness(direct.element); await ready(d);
    d.phone.call('x', '+33100000001'); await vi.advanceTimersByTimeAsync(0);
    direct.attach();
    d.invite.onProgress({ message: { statusCode: 183, body: 'v=0 fictional sdp' } });
    direct.unmute();
    expect(d.callProgress.stop).not.toHaveBeenCalled();
  });
});

it('does not place a delayed outgoing call after cancellation during relay preparation', async () => {
  const h=harness(); await ready(h);
  let resolve!: () => void;
  Object.assign(h.manager,{prepareMedia:() => new Promise<void>(r => {resolve=r;})});
  h.phone.call('1001','1001'); h.phone.hangup(); resolve();
  await Promise.resolve(); await Promise.resolve();
  expect(h.manager.call).not.toHaveBeenCalled();
  expect(h.phone.getSnapshot().call?.outcome).toBe('cancelled');
});

describe('SIP controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the original incoming ID and uses a concordant asserted international identity', async () => {
    const h = harness();
    await ready(h);
    const incoming = session('in', '5145550100', '5145550100');
    incoming.assertedIdentity = { uri: { user: '+15145550100' } };
    h.delegate.onCallReceived(incoming);
    expect(h.phone.getSnapshot().call).toMatchObject({ rawInput: '5145550100', dialTarget: '+15145550100', direction: 'inbound' });
    expect(h.phone.getSnapshot().call?.remoteName).toBeUndefined();
    expect(h.manager.call).not.toHaveBeenCalled();
  });

  it('does not recover a private identity', async () => {
    const h = harness();
    await ready(h);
    const incoming = session('in', '5145550100', '+15145550100');
    incoming.assertedIdentity = { uri: { user: '+15145550100' } };
    incoming.request = { getHeader: () => 'id' };
    h.delegate.onCallReceived(incoming);
    expect(h.phone.getSnapshot().call?.dialTarget).toBe('5145550100');
  });

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
    expect(h.phone.getSnapshot().error).toBe(t('sip.accessRefused'));
    expect(h.manager.register).toHaveBeenCalledTimes(1);
    expect(h.manager.holdsLine).not.toHaveBeenCalled();
  });

  it('says nothing more for a couple of mistakes, then how many attempts are left before a block', async () => {
    const h = harness();
    const asked: string[] = [];
    h.environment.blockStatus = async url => { asked.push(url); return { blocked: false, remaining: 0, weighted: 2, left: 8, nextBlock: 60 }; };
    await h.phone.connect({ username: 'alice', password: 'wrong' });
    h.reject(401);
    await vi.advanceTimersByTimeAsync(10);
    expect(h.phone.getSnapshot().error).toBe(t('sip.authRefused'));
    expect(asked).toEqual(['https://pbx.example/etat?echecs=1']);
    h.environment.blockStatus = async () => ({ blocked: false, remaining: 0, weighted: 6, left: 4, nextBlock: 60 });
    await h.phone.connect({ username: 'alice', password: 'wrong' });
    h.reject(401);
    await vi.advanceTimersByTimeAsync(10);
    expect(h.phone.getSnapshot().error).toBe(`${t('sip.authRefused')} ${t('sip.attemptsLeft', { count: 4, time: '1 min' })}`);
    h.environment.blockStatus = async () => ({ blocked: false, remaining: 0, weighted: 9, left: 1, nextBlock: 300 });
    await h.phone.connect({ username: 'alice', password: 'wrong' });
    h.reject(401);
    await vi.advanceTimersByTimeAsync(10);
    expect(h.phone.getSnapshot().error).toBe(`${t('sip.authRefused')} ${t('sip.attemptLeft', { count: 1, time: '5 min' })}`);
  });

  it('shows the site block with a countdown when the socket is refused, then lifts it', async () => {
    const h = harness();
    h.manager.connect.mockImplementationOnce(async () => { throw new Error('refused'); });
    h.environment.blockStatus = async () => ({ blocked: true, remaining: 61 });
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'blocked', account: null });
    expect(h.phone.getSnapshot().error).toBe(t('sip.blocked', { time: '1 min 01 s' }));
    await vi.advanceTimersByTimeAsync(31_000);
    expect(h.phone.getSnapshot().error).toBe(t('sip.blocked', { time: '30 s' }));
    // A new attempt during the block changes nothing: the countdown stays.
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    expect(h.phone.getSnapshot().connection).toBe('blocked');
    expect(h.manager.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'offline', error: t('sip.blockLifted') });
    expect(h.phone.getSnapshot().blockedUntil).toBeUndefined();
  });

  it('keeps the network message when the site is not blocked or the status page is unreachable', async () => {
    const h = harness();
    h.manager.connect.mockImplementation(async () => { throw new Error('refused'); });
    h.environment.blockStatus = async () => ({ blocked: false, remaining: 0 });
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'network-error', error: t('sip.serverUnreachable') });
    h.environment.blockStatus = async () => { throw new Error('offline'); };
    await h.phone.connect({ username: 'alice', password: 'fictional' });
    expect(h.phone.getSnapshot().connection).toBe('network-error');
  });

  it('switches to the block countdown when the refused registration was the one that triggered it', async () => {
    const h = harness();
    h.environment.blockStatus = async () => ({ blocked: true, remaining: 60 });
    await h.phone.connect({ username: 'alice', password: 'wrong' });
    h.reject(403);
    await vi.advanceTimersByTimeAsync(10);
    expect(h.phone.getSnapshot().connection).toBe('blocked');
  });

  it('allows two browser tabs to register without a local lock', async () => {
    const first = harness(), second = harness();
    await ready(first); await ready(second);
    expect(first.phone.getSnapshot().connection).toBe('ready');
    expect(second.phone.getSnapshot().connection).toBe('ready');
    expect(second.manager.register).toHaveBeenCalledTimes(1);
  });

  it.each([false, null])('does not unregister a newer tab when ownership is %s', async owns => {
    const h = harness(); await ready(h);
    h.manager.holdsLine.mockResolvedValue(owns);
    await h.phone.disconnect();
    expect(h.manager.unregister).not.toHaveBeenCalled();
    expect(h.manager.dropSilently).toHaveBeenCalledOnce();
    expect(h.phone.getSnapshot().connection).toBe('offline');
  });

  it.each([403, 404])('does not blame the password for a server refusal %s', async status => {
    const h = harness();
    await h.phone.connect({ username: 'alice', password: 'fictional' }); h.reject(status);
    expect(h.phone.getSnapshot().error).toContain(t('sip.accessRefused'));
    expect(h.phone.getSnapshot().error).not.toContain(t('sip.authRefused'));
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
    expect(h.callProgress.startRingback).toHaveBeenCalledWith(1);
    expect(h.phone.getSnapshot().call?.answeredAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    h.delegate.onCallAnswered(session('out'));
    expect(h.callProgress.stop).toHaveBeenCalled();
    expect(h.callProgress.answered).toHaveBeenCalledWith(1);
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
    for (const [status, outcome] of [[486, 'busy'], [480, 'failed'], [603, 'declined'], [503, 'failed']] as const) {
      const h = harness();
      await ready(h);
      h.phone.call('x', '+33100000001');
      await vi.advanceTimersByTimeAsync(0);
      h.delegate.onCallHangup(session('out'));
      h.invite.onReject(status);
      await Promise.resolve();
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

  it('keeps the exact SIP refusal and its meaning on the ended call', async () => {
    const cases = [
      [403, 'failed', 'Forbidden — appel interdit par le serveur'],
      [404, 'failed', 'Not Found — numéro ou destination introuvable'],
      [480, 'failed', '— appel indisponible pour le moment. Réessayez ; si cela persiste, contactez votre administrateur'],
      [486, 'busy', 'Busy Here — ligne occupée'],
      [488, 'failed', 'Not Acceptable Here — média ou codec refusé'],
      [503, 'failed', 'Service Unavailable — service téléphonique indisponible'],
    ] as const;
    for (const [status, outcome, meaning] of cases) {
      const h = harness();
      await ready(h);
      h.phone.call('x', '+33100000001');
      await vi.advanceTimersByTimeAsync(0);
      h.delegate.onCallHangup(session('out'));
      h.invite.onReject(status);
      await Promise.resolve();
      expect(h.phone.getSnapshot().call).toMatchObject({
        phase: 'ended', outcome, failure: `SIP ${status} ${meaning}.`,
      });
      expect(h.phone.getSnapshot().error).toBe(`SIP ${status} ${meaning}.`);
    }
  });

  it.each([
    [403, 'Insufficient Balance 19', undefined],
    [403, 'Insufficient credit', undefined],
    [503, 'Credit exhausted', undefined],
    [403, 'Crédit fini', undefined],
    [403, 'Forbidden', 'SIP;cause=403;text="Insufficient Balance 19"'],
  ])('keeps the explicit balance diagnostic on the ended call (%s, %s)', async (status, reason, header) => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallHangup(session('out'));
    h.invite.onReject(status, reason, header);
    await Promise.resolve();
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'failed', failure: t('sip.creditExhausted', { status }) });
    expect(h.phone.getSnapshot().error).toBe(t('sip.creditExhausted', { status }));
    h.phone.dismiss();
    h.phone.call('x', '+33100000002');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call?.failure).toBeUndefined();
  });

  it.each(['Forbidden', 'Loss to Destination 33 Exceeds Max Loss', 'Not insufficient balance', 'Credit check unavailable'])('does not invent exhausted credit from %s', async reason => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.invite.onReject(403, reason);
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call?.failure).toBe(t('sip.403'));
  });

  it('distinguishes payment required from explicit exhausted credit', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.invite.onReject(402, 'Payment Required');
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call?.failure).toBe(t('sip.402'));
  });

  it('ignores a late balance refusal belonging to the preceding call', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('first', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    const oldInvite = h.invite;
    h.phone.hangup();
    h.delegate.onCallHangup(session('out'));
    h.phone.dismiss();
    h.phone.call('second', '+33100000002');
    await vi.advanceTimersByTimeAsync(0);
    h.invite.onReject(486, 'Busy Here');
    oldInvite.onReject(403, 'Insufficient Balance 19');
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call).toMatchObject({ outcome: 'busy', failure: t('sip.486') });
  });

  it('does not carry a SIP refusal into the next call', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallHangup(session('out'));
    h.invite.onReject(403);
    await Promise.resolve();
    h.phone.dismiss();
    h.phone.call('x', '+33100000002');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.delegate.onCallHangup(session('out'));
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'answered', failure: undefined });
  });

  it('finishes an outgoing call even when no SIP refusal follows termination', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallHangup(session('out'));
    await Promise.resolve();
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'failed', failure: undefined });
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

  it('ends a dropped call without redialling and keeps recovering beyond a short outage', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.manager.isConnected.mockReturnValue(false);
    h.manager.connect.mockRejectedValue(new Error('offline'));
    h.delegate.onServerDisconnect(new Error('lost'));
    // The conversation took place: it stays answered, with the reason it stopped.
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'reconnecting', call: { phase: 'ended', outcome: 'answered' } });
    expect(h.phone.getSnapshot().call?.failure).toMatch(/interrompu/);
    await vi.advanceTimersByTimeAsync(20000);
    expect(h.phone.getSnapshot().connection).toBe('reconnecting');
    expect(h.manager.connect.mock.calls.length).toBeGreaterThan(2);
    expect(h.manager.call).toHaveBeenCalledTimes(1);
  });

  it('repairs an explicitly missing binding on an open socket', async () => {
    const h = harness(); await ready(h);
    h.manager.holdsLine.mockResolvedValue('missing');
    await vi.advanceTimersByTimeAsync(45_000);
    expect(h.manager.register).toHaveBeenCalledTimes(2);
    expect(h.phone.getSnapshot().connection).toBe('registering');
    h.manager.register.mock.calls[1]![0].requestDelegate.onAccept?.();
    expect(h.phone.getSnapshot().connection).toBe('ready');
    expect(h.manager.unregister).not.toHaveBeenCalled();
  });

  it('recovers a clean socket close and stops all recovery on manual sign-out', async () => {
    const h = harness(); await ready(h);
    h.manager.isConnected.mockReturnValue(false);
    h.manager.connect.mockRejectedValue(new Error('offline'));
    h.delegate.onServerDisconnect();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.phone.getSnapshot().connection).toBe('reconnecting');
    const attempts = h.manager.connect.mock.calls.length;
    expect(attempts).toBeGreaterThan(3);
    expect(attempts).toBeLessThan(16);
    await h.phone.disconnect();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(h.manager.connect).toHaveBeenCalledTimes(attempts);
    expect(h.phone.getSnapshot().connection).toBe('offline');
  });

  it('retries temporary registration failures but stops on an access refusal after recovery', async () => {
    const h = harness(); await ready(h);
    h.reject(503);
    await vi.advanceTimersByTimeAsync(1100);
    expect(h.manager.register).toHaveBeenCalledTimes(2);
    h.reject(403);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(h.manager.register).toHaveBeenCalledTimes(2);
    expect(h.phone.getSnapshot().connection).toBe('auth-error');
  });

  it('checks once after wake and never repairs a binding in the middle of a call', async () => {
    const h = harness(); await ready(h);
    h.manager.holdsLine.mockResolvedValue('missing');
    await Promise.all([h.phone.checkConnection(), h.phone.checkConnection()]);
    expect(h.manager.holdsLine).toHaveBeenCalledTimes(1);
    h.delegate.onRegistered();
    h.phone.call('123', '123'); await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(h.manager.register).toHaveBeenCalledTimes(2);
    expect(h.manager.hangup).not.toHaveBeenCalled();
  });

  it('does not step aside when a call starts while an ownership query is pending', async () => {
    const h = harness(); await ready(h);
    h.manager.holdsLine.mockResolvedValue(false);
    await h.phone.checkConnection(); await vi.advanceTimersByTimeAsync(1000);
    let resolve!: (value: false) => void;
    h.manager.holdsLine.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const check = h.phone.checkConnection();
    h.delegate.onCallReceived(session('incoming', '123'));
    h.delegate.onCallAnswered(session('incoming'));
    resolve(false); await check;
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', call: { phase: 'active' } });
    expect(h.manager.dropSilently).not.toHaveBeenCalled();
  });

  it('ignores a late ownership answer after sign-out', async () => {
    const h = harness(); await ready(h);
    let resolve!: (value: 'missing') => void;
    h.manager.holdsLine.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const check = h.phone.checkConnection();
    await h.phone.disconnect(); resolve('missing'); await check;
    expect(h.manager.register).toHaveBeenCalledTimes(1);
    expect(h.phone.getSnapshot().connection).toBe('offline');
  });

  it('ignores a retired manager’s callbacks after manual reconnect and stops on sign-out', async () => {
    const h = harness(); await ready(h);
    const oldDelegate = h.delegate;
    h.manager.isConnected.mockReturnValue(false);
    oldDelegate.onServerDisconnect();
    await h.phone.reconnect();
    oldDelegate.onRegistered(); oldDelegate.onLineTaken?.(); oldDelegate.onServerDisconnect();
    expect(h.phone.getSnapshot().connection).toBe('registering');
    expect(h.phone.getSnapshot().lineTaken).toBe(false);
    await h.phone.disconnect();
    h.delegate.onRegistered(); await vi.advanceTimersByTimeAsync(60_000);
    expect(h.phone.getSnapshot().connection).toBe('offline');
  });

  it('never refreshes the transport during a call or after a definitive refusal', async () => {
    const h = harness(); await ready(h);
    h.phone.call('123', '123'); await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    h.delegate.onUnregistered();
    await h.phone.reconnect();
    expect(h.manager.dropSilently).not.toHaveBeenCalled();
    h.reject(403);
    await h.phone.reconnect(); await vi.advanceTimersByTimeAsync(60_000);
    expect(h.manager.connect).toHaveBeenCalledTimes(1);
    expect(h.phone.getSnapshot().connection).toBe('auth-error');
  });

  it('retries a failed manager replacement without discarding the session', async () => {
    const h = harness(); await ready(h);
    h.delegate.onServerDisconnect();
    const create = h.environment.createManager;
    h.environment.createManager = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockImplementation(create);
    await h.phone.reconnect();
    expect(h.phone.getSnapshot().account?.username).toBe('alice');
    await vi.advanceTimersByTimeAsync(2100);
    h.delegate.onRegistered();
    expect(h.phone.getSnapshot().connection).toBe('ready');
    expect(h.environment.createManager).toHaveBeenCalledTimes(2);
  });

  it('hangs up, unregisters and frees the line on disconnect', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    await h.phone.disconnect();
    expect(h.manager.hangup).toHaveBeenCalled();
    expect(h.manager.unregister).toHaveBeenCalled();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'offline', call: null, account: null });
  });

  it('requests call termination even when the server socket closes without an error', async () => {
    const h = harness();
    await ready(h);
    h.phone.call('x', '+33100000001');
    h.delegate.onCallAnswered(session('out'));
    h.delegate.onServerDisconnect();
    expect(h.manager.hangup).toHaveBeenCalledWith(expect.objectContaining({ id: 'out' }));
    expect(h.phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'answered' });
    expect(h.manager.call).toHaveBeenCalledTimes(1);
  });

  it('finishes disconnecting before a fresh sign-in', async () => {
    const h = harness();
    await ready(h);
    let finish!: () => void;
    h.manager.disconnect.mockImplementationOnce(() => new Promise<undefined>(resolve => { finish = () => resolve(undefined); }));
    let offline = false;
    const done = h.phone.disconnect().then(() => { offline = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(offline).toBe(false);
    finish(); await done;
    expect(h.phone.getSnapshot().connection).toBe('offline');
    await ready(h);
    expect(h.phone.getSnapshot().connection).toBe('ready');
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

  it('asks the PBX who holds the account and steps aside only on a certain answer, without un-registering', async () => {
    const h = harness();
    await ready(h);
    // Our confirmed contact never pauses the line. Unknown answers are covered
    // by the real SIP.js integration tests (fresh socket with its ownership guard).
    h.manager.holdsLine.mockResolvedValue(true);
    h.delegate.onRegistered();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', lineTaken: false });
    // One odd answer is not enough…
    h.manager.holdsLine.mockResolvedValueOnce(false);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(h.phone.getSnapshot().lineTaken).toBe(false);
    // …two in a row are: another device holds the account.
    h.manager.holdsLine.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'other-tab-active', lineTaken: true, account: { username: 'alice' } });
    expect(h.manager.dropSilently).toHaveBeenCalledTimes(1);
    // An un-REGISTER would disconnect the device that now holds the line.
    expect(h.manager.unregister).not.toHaveBeenCalled();
    // No tug of war: nothing happens until the person asks.
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(h.manager.register).toHaveBeenCalledTimes(1);
    h.manager.holdsLine.mockResolvedValue(true);
    h.phone.retakeLine();
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onRegistered();
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', lineTaken: false });
    expect(h.manager.register).toHaveBeenCalledTimes(2);
  });

  it('never steps aside in the middle of a conversation', async () => {
    const h = harness();
    await ready(h);
    h.manager.holdsLine.mockResolvedValue(false);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    await vi.advanceTimersByTimeAsync(400_000);
    expect(h.phone.getSnapshot()).toMatchObject({ connection: 'ready', call: { phase: 'active' } });
    h.delegate.onCallHangup(session('out'));
    h.phone.dismiss();
    await vi.advanceTimersByTimeAsync(95_000);
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

describe('one-way audio', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tells the person when their voice does not leave the browser', async () => {
    const h = harness();
    await ready(h);
    h.manager.sentAudioPackets.mockResolvedValue(0);
    h.phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(0);
    h.delegate.onCallAnswered(session('out'));
    await vi.advanceTimersByTimeAsync(5500);
    expect(h.phone.getSnapshot().error).toMatch(/ne vous entend pas/);
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
