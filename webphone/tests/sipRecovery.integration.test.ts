import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SipPhoneController } from '../src/telephony/SipPhoneController';
import { browserSipEnvironment } from '../src/telephony/sipEnvironment';

// Real SIP.js 0.21.2, with only the network replaced by a local deterministic registrar.
// No client account, PBX, microphone or outbound call is used.
let binding: string | undefined;
let networkUp = true;
let registrations: string[] = [];
let sockets: RegistrarSocket[] = [];
let keepalives = 0;
class RegistrarSocket extends EventTarget {
  static OPEN = 1;
  readyState = 0;
  binaryType = '';
  silent = false;
  stuckClose = false;
  constructor(url: string, protocol: string) {
    super();
    if (url !== 'wss://pbx.example/ws' || protocol !== 'sip') throw new Error('Invalid test transport');
    if (!networkUp) throw new Error('Simulated network outage');
    sockets.push(this);
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); });
  }
  send(message: string) {
    if (this.silent) return;
    if (!message.trim()) { keepalives++; return; }
    const lines = message.split('\r\n');
    const header = (name: string) => lines.find(line => line.toLowerCase().startsWith(name.toLowerCase() + ':'))?.split(':').slice(1).join(':').trim();
    if (!lines[0]?.startsWith('REGISTER ')) throw new Error('Unexpected SIP request');
    const contact = header('Contact');
    if (contact) { registrations.push(message); binding = /expires=0(?:;|$)/.test(contact) ? undefined : contact; }
    const response = ['SIP/2.0 200 OK', ...['Via', 'From', 'To', 'Call-ID', 'CSeq'].map(name => `${name}: ${header(name)}`),
      ...(binding ? [`Contact: ${binding}`] : []), 'Content-Length: 0', '', ''].join('\r\n');
    queueMicrotask(() => this.dispatchEvent(Object.assign(new Event('message'), { data: response })));
  }
  close(code = 1000) {
    if (this.stuckClose) return;
    this.readyState = 3;
    queueMicrotask(() => this.dispatchEvent(Object.assign(new Event('close'), { code, reason: '', wasClean: code === 1000 })));
  }
}
let phone: SipPhoneController;
async function tick(ms = 10) { await vi.advanceTimersByTimeAsync(ms); }
async function login() {
  await phone.connect({ username: 'test-line', password: 'fictional-only' });
  await tick();
  expect(phone.getSnapshot().connection).toBe('ready');
}

describe('recovery through real SIP.js registration and transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('WebSocket', RegistrarSocket);
    binding = undefined; registrations = []; sockets = []; networkUp = true; keepalives = 0;
    phone = new SipPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example/ws' }, {
      ...browserSipEnvironment, createRemoteAudio: () => undefined,
    }, { startRingback() {}, answered() {}, stop() {} });
  });
  afterEach(async () => { await phone.disconnect(); await tick(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('repairs a lost PBX binding on the same socket and renews before expiry', async () => {
    await login();
    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toContain('expires=300');
    binding = undefined;
    await tick(45_100);
    expect(registrations).toHaveLength(2);
    expect(phone.getSnapshot().connection).toBe('ready');
    expect(sockets).toHaveLength(1);
    await tick(150_100);
    expect(registrations.length).toBeGreaterThanOrEqual(3);
    expect(keepalives).toBeGreaterThan(0);
  });

  it('recovers after an outage longer than the old 18-second cutoff', async () => {
    await login();
    networkUp = false; sockets[0]!.close(1006); binding = undefined;
    await tick(90_000);
    expect(phone.getSnapshot().connection).not.toBe('ready');
    networkUp = true;
    await tick(61_000);
    expect(phone.getSnapshot().connection).toBe('ready');
    expect(registrations).toHaveLength(2);
  });

  it('does not take another device’s binding after transport recovery', async () => {
    await login();
    networkUp = false; sockets[0]!.close(1006);
    await tick(20_000);
    binding = '<sip:another-device@elsewhere.invalid;transport=wss>;expires=300';
    networkUp = true;
    await tick(61_000);
    expect(phone.getSnapshot().connection).toBe('other-tab-active');
    expect(registrations).toHaveLength(1);
    expect(binding).toContain('another-device');
  });
  it('replaces a blackholed socket after a network change, preserving the contact and workspace', async () => {
    await login();
    const contact = binding!.match(/sip:([^@]+)@/)![1];
    const account = phone.getSnapshot().account;
    sockets[0]!.silent = true;
    sockets[0]!.stuckClose = true;
    const checking = phone.checkConnection();
    await tick(8100); await checking;
    expect(phone.getSnapshot()).toMatchObject({ connection: 'ready', account });
    expect(sockets).toHaveLength(2);
    expect(binding).toContain(`sip:${contact}@`);
    expect(registrations).toHaveLength(2);
    expect(registrations.some(message => /expires=0(?:;|\r)/.test(message))).toBe(false);
    sockets[0]!.stuckClose = false; sockets[0]!.close(); await tick();
    expect(phone.getSnapshot().connection).toBe('ready');
  });

  it('lets the person retry a long outage immediately without a new login or overlapping clicks', async () => {
    await login();
    networkUp = false; sockets[0]!.close(1006); await tick(10_000);
    const since = phone.getSnapshot().recoverySince;
    expect(since).toBeDefined();
    networkUp = true;
    await Promise.all([phone.reconnect(), phone.reconnect(), phone.reconnect()]); await tick();
    expect(sockets).toHaveLength(2);
    expect(phone.getSnapshot()).toMatchObject({ connection: 'ready', account: { username: 'test-line' } });
    expect(phone.getSnapshot().recoverySince).toBeUndefined();
    expect(registrations).toHaveLength(2);
  });

  it('does not steal a different contact on explicit reconnect and ignores retired socket events', async () => {
    await login();
    networkUp = false; sockets[0]!.close(1006); await tick(10_000);
    binding = '<sip:another-device@elsewhere.invalid;transport=wss>;expires=300';
    networkUp = true;
    await phone.reconnect(); await tick();
    expect(phone.getSnapshot().connection).toBe('other-tab-active');
    expect(registrations).toHaveLength(1);
    expect(binding).toContain('another-device');
    await phone.reconnect(); await tick(60_000);
    expect(sockets).toHaveLength(2);
  });

  it('keeps a missing ownership response uncertain even on a fresh socket', async () => {
    await login();
    sockets[0]!.silent = true;
    const checking = phone.checkConnection();
    await tick(8000); await checking;
    // The new socket is also blackholed before its guard can answer.
    sockets[1]!.silent = true;
    await tick(9000);
    expect(phone.getSnapshot().connection).not.toBe('ready');
    expect(phone.getSnapshot().account?.username).toBe('test-line');
    expect(registrations).toHaveLength(1);
  });

});
