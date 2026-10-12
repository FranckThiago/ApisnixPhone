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
  constructor(url: string, protocol: string) {
    super();
    if (url !== 'wss://pbx.example/ws' || protocol !== 'sip') throw new Error('Invalid test transport');
    if (!networkUp) throw new Error('Simulated network outage');
    sockets.push(this);
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); });
  }
  send(message: string) {
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
});
