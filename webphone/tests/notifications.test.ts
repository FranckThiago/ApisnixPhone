import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhoneSnapshot } from '../src/telephony/types';

beforeEach(() => {
  vi.resetModules();
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
  vi.stubGlobal('navigator', {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const ended = { phase: 'ended', direction: 'outbound', id: 'first' } as NonNullable<PhoneSnapshot['call']>;

describe('notification offer', () => {
  it('offers only after a real outgoing or answered call, once per browser', async () => {
    const api = await import('../src/telephony/notifications');
    expect(api.shouldOfferAfterCall({ call: ended, demo: true }, false)).toBe(false);
    expect(api.shouldOfferAfterCall({ call: { ...ended, phase: 'active' }, demo: false }, false)).toBe(false);
    expect(api.shouldOfferAfterCall({ call: { ...ended, direction: 'inbound' }, demo: false }, false)).toBe(false);
    expect(api.shouldOfferAfterCall({ call: { ...ended, direction: 'inbound', answeredAt: 1 }, demo: false }, false)).toBe(true);
    expect(api.shouldOfferAfterCall({ call: ended, demo: false }, true)).toBe(false);
    expect(api.shouldOfferAfterCall({ call: ended, demo: false }, false)).toBe(true);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    api.markNotificationsOffered();
    expect(api.canOfferNotifications()).toBe(false);
    vi.resetModules();
    expect((await import('../src/telephony/notifications')).canOfferNotifications()).toBe(false);
  });

  it('remembers activation and explicit disable locally across reloads', async () => {
    const api = await import('../src/telephony/notifications');
    expect(await api.enableNotifications()).toBe('granted');
    expect(Notification.requestPermission).toHaveBeenCalledOnce();
    Object.assign(Notification, { permission: 'granted' });
    expect(api.notificationsEnabled()).toBe(true);
    api.disableNotifications();
    vi.resetModules();
    expect((await import('../src/telephony/notifications')).notificationsEnabled()).toBe(false);
  });

  it.each(['denied', 'granted'])('does not offer again when permission is %s', async permission => {
    Object.assign(Notification, { permission });
    const api = await import('../src/telephony/notifications');
    expect(api.canOfferNotifications()).toBe(false);
  });

  it('handles browser refusal or unavailable APIs without throwing', async () => {
    vi.mocked(Notification.requestPermission).mockRejectedValue(new Error('Blocked'));
    const api = await import('../src/telephony/notifications');
    expect(await api.enableNotifications()).toBe('unavailable');
    vi.stubGlobal('Notification', undefined);
    expect(api.canOfferNotifications()).toBe(false);
    expect(await api.enableNotifications()).toBe('unavailable');
  });
});

describe('mobile notification delivery', () => {
  it('uses the worker instead of the mobile-incompatible constructor and closes the alert', async () => {
    Object.assign(Notification, { permission: 'granted' });
    const close = vi.fn();
    const worker = { active: {}, showNotification: vi.fn(async () => undefined), getNotifications: vi.fn(async () => [{ close }]) };
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn(async () => worker) } });
    const api = await import('../src/telephony/notifications');
    expect(await api.enableNotifications()).toBe('granted');
    const dismiss = api.showSystemNotification('Incoming', { tag: 'call-1' });
    await vi.waitFor(() => expect(worker.showNotification).toHaveBeenCalledWith('Incoming', expect.objectContaining({ tag: 'call-1' })));
    dismiss();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it('never shows a late incoming alert after the call has ended', async () => {
    Object.assign(Notification, { permission: 'granted' });
    const worker = { active: {}, showNotification: vi.fn() };
    let resolve!: (value: typeof worker) => void;
    const pending = new Promise<typeof worker>(done => { resolve = done; });
    vi.stubGlobal('navigator', { serviceWorker: { register: () => pending } });
    const api = await import('../src/telephony/notifications');
    const dismiss = api.showSystemNotification('Incoming', { tag: 'call-1' });
    dismiss();
    resolve(worker);
    await pending;
    await new Promise(done => setTimeout(done, 0));
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it('absorbs notification constructor failures instead of crashing the call screen', async () => {
    vi.stubGlobal('Notification', class { static permission = 'granted'; constructor() { throw new TypeError('Illegal constructor'); } });
    const api = await import('../src/telephony/notifications');
    expect(() => api.showSystemNotification('Incoming', { tag: 'call-1' })()).not.toThrow();
  });
});
