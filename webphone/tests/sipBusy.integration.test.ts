import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Web } from 'sip.js';
import { SipPhoneController, type Manager, type ManagerDelegate } from '../src/telephony/SipPhoneController';
import { browserSipEnvironment } from '../src/telephony/sipEnvironment';

// Real SIP.js parser, INVITE transactions and SessionManager; local transport only.
// No microphone, media server or client line is used.
let sockets: TestSocket[];
let sent: string[];
class TestSocket extends EventTarget {
  static OPEN = 1;
  readyState = 0;
  binaryType = '';
  constructor() {
    super(); sockets.push(this);
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); });
  }
  receive(data: string) { this.dispatchEvent(Object.assign(new Event('message'), { data })); }
  send(message: string) {
    sent.push(message);
    if (!message.startsWith('REGISTER ')) return;
    const lines = message.split('\r\n');
    const header = (name: string) => lines.find(line => line.toLowerCase().startsWith(name.toLowerCase() + ':'))!;
    const response = ['SIP/2.0 200 OK', ...['Via', 'From', 'To', 'Call-ID', 'CSeq'].map(header),
      ...(lines.filter(line => line.startsWith('Contact:'))), 'Content-Length: 0', '', ''].join('\r\n');
    queueMicrotask(() => this.receive(response));
  }
  close(code = 1000) {
    this.readyState = 3;
    queueMicrotask(() => this.dispatchEvent(Object.assign(new Event('close'), { code, reason: '', wasClean: true })));
  }
}
let phone: SipPhoneController;
let manager: Manager & Web.SessionManager;
let delegate: ManagerDelegate;
async function tick() { await vi.advanceTimersByTimeAsync(10); }
async function incoming(id: string) {
  const contact = manager.userAgent.contact.uri.toString();
  sockets[0]!.receive([
    `INVITE ${contact} SIP/2.0`, `Via: SIP/2.0/WSS pbx.example;branch=z9hG4bK-${id}`,
    'Max-Forwards: 70', `From: <sip:caller@pbx.example>;tag=from-${id}`, `To: <${contact}>`,
    `Call-ID: ${id}`, 'CSeq: 1 INVITE', 'Contact: <sip:caller@pbx.example>',
    'Content-Length: 0', '', '',
  ].join('\r\n'));
  await tick();
}
function responses(id: string) { return sent.filter(m => m.startsWith('SIP/2.0') && m.includes(`Call-ID: ${id}\r\n`)); }

describe('one incoming call through real SIP.js', () => {
  beforeEach(async () => {
    vi.useFakeTimers(); sockets = []; sent = [];
    vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('WebSocket', TestSocket);
    phone = new SipPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example/ws' }, {
      ...browserSipEnvironment, createRemoteAudio: () => undefined,
      createManager: async (...args) => {
        delegate = args[2];
        manager = await browserSipEnvironment.createManager(...args) as Manager & Web.SessionManager;
        return manager;
      },
    }, { startRingback() {}, answered() {}, stop() {} });
    await phone.connect({ username: 'test-line', password: 'fictional-only' }); await tick();
    expect(phone.getSnapshot().connection).toBe('ready');
  });
  afterEach(async () => { await phone.disconnect(); await tick(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('returns 486 before admitting a second call and keeps the first session and screen', async () => {
    await incoming('first');
    const first = phone.getSnapshot().call;
    expect(first?.phase).toBe('ringing-in');
    const session = manager.managedSessions[0]!.session;
    const close = vi.spyOn(manager, 'hangup');
    await incoming('second');
    expect(responses('second').some(m => m.startsWith('SIP/2.0 486'))).toBe(true);
    expect(phone.getSnapshot().call).toBe(first);
    expect(manager.managedSessions.map(s => s.session)).toEqual([session]);
    expect(close).not.toHaveBeenCalled();
    phone.decline(); await tick();
    expect(phone.getSnapshot().call?.phase).toBe('ended');
    await incoming('third');
    expect(phone.getSnapshot().call?.phase).toBe('ringing-in');
    expect(phone.getSnapshot().call?.id).not.toBe(first?.id);
  });

  it('protects active and held calls from repeated INVITEs without replacing their controls', async () => {
    await incoming('first');
    const session = manager.managedSessions[0]!.session;
    // Controller phases are simulated without media. Extra INVITEs still pass
    // through the real parser/transactions; this is not an audio quality test.
    delegate.onCallAnswered(session);
    const active = phone.getSnapshot().call;
    await incoming('during-active');
    expect(phone.getSnapshot().call).toBe(active);
    expect(responses('during-active').some(m => m.startsWith('SIP/2.0 486'))).toBe(true);
    delegate.onCallHold(session, true);
    const held = phone.getSnapshot().call;
    await incoming('during-held');
    expect(phone.getSnapshot().call).toBe(held);
    expect(responses('during-held').some(m => m.startsWith('SIP/2.0 486'))).toBe(true);
    expect(manager.managedSessions).toHaveLength(1);
    const hangup = vi.spyOn(manager, 'hangup');
    phone.hangup();
    expect(hangup).toHaveBeenCalledWith(session);
  });

  it('protects outgoing preparation even before a SIP session exists', async () => {
    let resolve!: () => void;
    manager.prepareMedia = () => new Promise<void>(r => { resolve = r; });
    phone.call('1001', '1001');
    const outgoing = phone.getSnapshot().call;
    expect(manager.managedSessions).toHaveLength(0);
    await incoming('during-preparation');
    expect(responses('during-preparation').some(m => m.startsWith('SIP/2.0 486'))).toBe(true);
    expect(phone.getSnapshot().call).toBe(outgoing);
    expect(manager.managedSessions).toHaveLength(0);
    phone.hangup(); resolve(); await tick();
    await incoming('after-cancel');
    expect(phone.getSnapshot().call?.phase).toBe('ringing-in');
  });

  it('does not let a failed rejection end the current call', async () => {
    await incoming('first');
    const first = phone.getSnapshot().call;
    const reject = vi.fn(async () => { throw new Error('Transport closed during rejection'); });
    manager.userAgent.delegate!.onInvite!({ reject } as never);
    await tick();
    expect(reject).toHaveBeenCalledWith({ statusCode: 486 });
    expect(phone.getSnapshot().call).toBe(first);
    expect(manager.managedSessions).toHaveLength(1);
  });

  it('rejects an INVITE on an old connection after a new connection is ready', async () => {
    const old = manager;
    await phone.disconnect(); await tick();
    await phone.connect({ username: 'test-line', password: 'fictional-only' }); await tick();
    expect(phone.getSnapshot().connection).toBe('ready');
    const reject = vi.fn(async () => undefined);
    old.userAgent.delegate!.onInvite!({ reject } as never);
    await tick();
    expect(reject).toHaveBeenCalledWith({ statusCode: 486 });
    expect(phone.getSnapshot().call).toBeNull();
    expect(manager.managedSessions).toHaveLength(0);
  });
});
