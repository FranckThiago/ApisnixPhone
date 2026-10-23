import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApisnixPhone } from '../src/embed/client';
import { PROTOCOL } from '../src/embed/protocol';

function harness(mode?: 'conference') {
  const listeners = new Map<string, (event: MessageEvent) => void>();
  const frameListeners = new Map<string, () => void>();
  const frame = { contentWindow: { postMessage: vi.fn() }, style: { cssText: '' }, src: '', allow: '', title: '', referrerPolicy: '', remove: vi.fn(),
    addEventListener: (type: string, listener: () => void) => frameListeners.set(type, listener),
    removeEventListener: (type: string) => frameListeners.delete(type) };
  vi.stubGlobal('window', { addEventListener: (type: string, listener: (event: MessageEvent) => void) => listeners.set(type, listener), removeEventListener: (type: string) => listeners.delete(type) });
  vi.stubGlobal('document', { createElement: vi.fn(() => frame) });
  const onEvent = vi.fn(); const onError = vi.fn();
  const host = { append: vi.fn() };
  const client = createApisnixPhone({ container: host as unknown as HTMLElement, url: 'https://phone.example', phone: '1001', mode, onEvent, onError });
  vi.advanceTimersByTime(250);
  const channel = frame.contentWindow.postMessage.mock.calls[0]![0].channel as string;
  const receive = (message: object, patch: object = {}) => listeners.get('message')?.({ origin: 'https://phone.example', source: frame.contentWindow, data: { protocol: PROTOCOL, channel, ...message }, ...patch } as unknown as MessageEvent);
  return { client, receive, onEvent, onError, frame, frameListeners, host, listeners, channel };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('SDK lifecycle', () => {
  it('mounts one frame with a public identifier, exact microphone policy and no password', () => {
    const h = harness();
    expect(h.host.append).toHaveBeenCalledTimes(1);
    expect(h.frame.src).toBe('https://phone.example/embed?phone=1001');
    expect(h.frame.allow).toBe('microphone https://phone.example; autoplay https://phone.example');
    expect(h.frame.referrerPolicy).toBe('no-referrer');
    expect(h.frame.contentWindow.postMessage.mock.calls[0]![1]).toBe('https://phone.example');
    h.client.destroy();
  });
  it('ignores a forged ready from another origin, frame or channel', async () => {
    const h = harness();
    h.receive({ type: 'ready' }, { origin: 'https://evil.example' });
    h.receive({ type: 'ready' }, { source: {} });
    h.receive({ type: 'ready', channel: '00000000-0000-0000' });
    expect(h.onEvent).not.toHaveBeenCalled();
    await expect(h.client.prepareCall('1001')).rejects.toThrow('phone-not-ready');
    h.receive({ type: 'ready' });
    expect(h.onEvent).toHaveBeenCalledTimes(1);
    h.client.destroy();
  });
  it('correlates a command response without placing an automatic call', async () => {
    const h = harness(); h.receive({ type: 'ready' });
    const promise = h.client.prepareCall('+33100000001');
    const request = h.frame.contentWindow.postMessage.mock.calls.at(-1)![0];
    expect(request.type).toBe('prepare-call');
    expect(request.number).toBe('+33100000001');
    h.receive({ type: 'result', requestId: request.requestId, code: 'prepared' });
    await expect(promise).resolves.toBe('prepared');
    expect(vi.getTimerCount()).toBe(0);
    h.client.destroy();
  });
  it('bounds handshake and command waits, and clears pending requests on destroy', async () => {
    const h = harness(); vi.advanceTimersByTime(12_000);
    expect(h.onError).toHaveBeenCalledWith('handshake-timeout');
    expect(vi.getTimerCount()).toBe(0);
    h.client.destroy();
    const next = harness(); next.receive({ type: 'ready' });
    const pending = next.client.prepareCall('1001');
    const assertion = expect(pending).rejects.toThrow('phone-destroyed');
    next.client.destroy(); await assertion;
    expect(next.frame.remove).toHaveBeenCalledTimes(1);
    expect(next.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('re-establishes the channel after iframe reload and refuses commands until ready', async () => {
    const h = harness(); h.receive({ type: 'ready' });
    h.frameListeners.get('load')?.();
    await expect(h.client.prepareCall('1001')).rejects.toThrow('phone-not-ready');
    h.receive({ type: 'ready' });
    const promise = h.client.prepareCall('1002');
    const request = h.frame.contentWindow.postMessage.mock.calls.at(-1)![0];
    h.receive({ type: 'result', requestId: request.requestId, code: 'not-connected' });
    await expect(promise).resolves.toBe('not-connected');
    expect(vi.getTimerCount()).toBe(0);
    h.client.destroy();
  });
  it('expires unanswered commands rather than reporting a successful preparation', async () => {
    const h = harness(); h.receive({ type: 'ready' });
    const promise = h.client.prepareCall('1001');
    const assertion = expect(promise).rejects.toThrow('command-timeout');
    vi.advanceTimersByTime(5000); await assertion;
    h.client.destroy();
  });
});

describe('CRM context and conference watchdog', () => {
  it('sends a bounded card to the exact frame and correlates its response', async () => {
    const h = harness(); h.receive({ type: 'ready' });
    const contact = { firstName: 'Camille', lastName: 'Martin', phone: '1001', email: 'c@example.invalid', company: 'Example', address: '12 Example', city: 'Paris', country: 'France' };
    const pending = h.client.setContact(contact, 'bridge-1');
    const message = h.frame.contentWindow.postMessage.mock.calls.at(-1)![0];
    expect(message).toMatchObject({ type: 'set-contact', contact, callId: 'bridge-1' });
    h.receive({ type: 'result', requestId: message.requestId, code: 'contact-updated' });
    await expect(pending).resolves.toBe('contact-updated');
    await expect(h.client.setContact({ notes: 'x'.repeat(2001) })).resolves.toBe('invalid-contact');
    h.client.destroy();
  });
  it('reports missing conference heartbeat and reload so the CRM can pause', () => {
    const h = harness('conference'); h.receive({ type: 'ready' });
    expect(h.frame.src).toContain('mode=conference');
    vi.advanceTimersByTime(6000);
    expect(h.onError).toHaveBeenCalledWith('heartbeat-timeout');
    h.onError.mockClear(); h.receive({ type: 'ready' });
    h.frameListeners.get('load')?.();
    expect(h.onError).toHaveBeenCalledWith('heartbeat-timeout');
    h.client.destroy(); expect(vi.getTimerCount()).toBe(0);
  });
});
