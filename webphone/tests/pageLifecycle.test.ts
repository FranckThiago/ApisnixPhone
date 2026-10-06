import { describe, expect, it, vi } from 'vitest';
import { bindPageLifecycle } from '../src/telephony/pageLifecycle';
import type { PhoneController, PhoneSnapshot } from '../src/telephony/types';

function harness() {
  const target = Object.assign(new EventTarget(), { location: { reload: vi.fn() } });
  let call: PhoneSnapshot['call'] = { id: 'test', direction: 'outbound', rawInput: '123', dialTarget: '123', phase: 'active', muted: false, holdPending: false, startedAt: 1, dtmf: '' };
  const phone = { getSnapshot: () => ({ call }), disconnect: vi.fn(async () => undefined) };
  const cleanup = bindPageLifecycle(phone as unknown as PhoneController, target as unknown as Window);
  return { target, phone, cleanup, end: () => { call = null; } };
}

describe('page lifecycle', () => {
  it('warns during a call without hanging up when navigation may be cancelled', () => {
    const h = harness();
    const e = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(e, 'returnValue', { writable: true, value: undefined });
    h.target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(h.phone.disconnect).not.toHaveBeenCalled();
    h.end();
    const idle = new Event('beforeunload', { cancelable: true });
    h.target.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
  });
  it('starts disconnect immediately when the page actually leaves, including bfcache', () => {
    const h = harness();
    h.target.dispatchEvent(new Event('pagehide'));
    expect(h.phone.disconnect).toHaveBeenCalledTimes(1);
  });
  it('never drops a call merely because the tab is hidden or a view changes', () => {
    const h = harness();
    h.target.dispatchEvent(new Event('visibilitychange'));
    h.target.dispatchEvent(new Event('popstate'));
    expect(h.phone.disconnect).not.toHaveBeenCalled();
  });
  it('refreshes only documents restored from the page cache', () => {
    const h = harness();
    h.target.dispatchEvent(new Event('pageshow'));
    expect(h.target.location.reload).not.toHaveBeenCalled();
    const cached = Object.assign(new Event('pageshow'), { persisted: true });
    h.target.dispatchEvent(cached);
    expect(h.target.location.reload).toHaveBeenCalledTimes(1);
  });
  it('removes listeners without disconnecting on a React cleanup', () => {
    const h = harness(); h.cleanup();
    h.target.dispatchEvent(new Event('pagehide'));
    expect(h.phone.disconnect).not.toHaveBeenCalled();
  });
});
