import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerDelegate } from '../src/telephony/SipPhoneController';
import { browserSipEnvironment } from '../src/telephony/sipEnvironment';

const fake = vi.hoisted(() => ({
  options: undefined as unknown as {
    delegate: ManagerDelegate;
    registerGuard(): Promise<boolean>;
    userAgentOptions: { sessionDescriptionHandlerFactory(session: unknown, options: unknown): unknown };
  },
  factoryOptions: [] as unknown[],
  contacts: [] as string[],
  responds: true,
  connected: true,
  reject: false,
}));
vi.mock('sip.js', () => ({
  UserAgent: { makeURI: (uri: string) => uri },
  Web: {
    defaultSessionDescriptionHandlerFactory: () => (_session: unknown, options: unknown) => { fake.factoryOptions.push(options); return { close() {} }; },
    SessionManager: class {
      managedSessions = [];
      constructor(_url: string, options: typeof fake.options) { fake.options = options; }
      disconnect = vi.fn(async () => undefined);
      userAgent = {
        delegate: { onInvite: vi.fn() },
        contact: { uri: { user: 'this-browser' } },
        transport: { isConnected: () => fake.connected, disconnect: vi.fn(async () => undefined) },
        userAgentCore: {
          makeOutgoingRequestMessage: vi.fn(() => ({})),
          request: (_message: unknown, delegate: { onAccept(response: unknown): void; onReject(): void }) => {
            if (!fake.responds) return;
            if (fake.reject) return delegate.onReject();
            delegate.onAccept({ message: { getHeaders: () => fake.contacts } });
          },
        },
      };
    },
  },
}));

async function setup() {
  const delegate = { onRegistered: vi.fn(), onLineTaken: vi.fn(), canReceiveCall: () => true } as unknown as ManagerDelegate;
  const manager = await browserSipEnvironment.createManager(
    { domain: 'pbx.example', wssUrl: 'wss://pbx.example/ws' },
    { username: 'test', password: 'fictional-only' }, delegate,
    async () => { throw new Error('No microphone required'); }, undefined,
  );
  return { manager, delegate };
}

describe('SIP registration ownership during recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); fake.contacts = []; fake.responds = true; fake.connected = true; fake.reject = false; });
  afterEach(() => vi.useRealTimers());
  it('distinguishes an empty binding, our binding, and another device', async () => {
    const { manager } = await setup();
    expect(await manager.holdsLine()).toBe('missing');
    fake.contacts = ['<sip:this-browser@random.invalid;transport=wss>;expires=300'];
    expect(await manager.holdsLine()).toBe(true);
    fake.contacts = ['<sip:another-browser@random.invalid;transport=wss>;expires=300'];
    expect(await manager.holdsLine()).toBe(false);
  });
  it('never interprets timeout, rejection or a closed transport as an empty binding', async () => {
    const { manager } = await setup();
    fake.responds = false;
    const query = manager.holdsLine(); await vi.advanceTimersByTimeAsync(8000);
    expect(await query).toBeNull();
    fake.responds = true; fake.reject = true;
    expect(await manager.holdsLine()).toBeNull();
    fake.reject = false; fake.connected = false;
    expect(await manager.holdsLine()).toBeNull();
  });
  it('allows explicit login, then guards automatic re-registration against another device or uncertainty', async () => {
    const { delegate } = await setup();
    fake.contacts = ['<sip:other@random.invalid>;expires=300'];
    expect(await fake.options.registerGuard()).toBe(false);
    fake.options.delegate.onRegistered();
    expect(await fake.options.registerGuard()).toBe(true);
    expect(delegate.onLineTaken).toHaveBeenCalledTimes(1);
    fake.contacts = [];
    expect(await fake.options.registerGuard()).toBe(false);
    fake.reject = true;
    expect(await fake.options.registerGuard()).toBe(true);
  });
});

describe('media preparation from the server pilot', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('prepares early media on a direct-only line and builds the connection with the default STUN', async () => {
    const settings = { enabled: true, account: 'test', expiresAt: Date.now() + 8 * 3600000, iceTransportPolicy: 'all', earlyMedia: true, csrf: 'c', iceServers: [] };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(settings)));
    const { manager } = await setup();
    expect(await manager.prepareMedia!()).toEqual({ earlyMedia: true });
    fake.options.userAgentOptions.sessionDescriptionHandlerFactory({ id: 's1' }, {});
    expect(fake.factoryOptions.at(-1)).toEqual({ peerConnectionConfiguration: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceTransportPolicy: 'all' } });
  });
  it('leaves an unpiloted line on its existing path without early media', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ enabled: false })));
    const { manager } = await setup();
    expect(await manager.prepareMedia!()).toEqual({ earlyMedia: false });
    fake.options.userAgentOptions.sessionDescriptionHandlerFactory({ id: 's2' }, { given: true });
    expect(fake.factoryOptions.at(-1)).toEqual({ given: true });
  });
});
