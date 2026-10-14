import { describe, expect, it, vi } from 'vitest';
import { bindCallWakeLock } from '../src/telephony/callWakeLock';
import type { PhoneController } from '../src/telephony/types';

function setup(delayed = false) {
  let phase: string | undefined = 'active', listener = () => undefined;
  const sentinel = Object.assign(new EventTarget(), {release: vi.fn(async () => undefined)});
  let resolve!: (value: typeof sentinel) => void;
  const request = vi.fn(() => delayed ? new Promise<typeof sentinel>(r => {resolve=r;}) : Promise.resolve(sentinel));
  const document = Object.assign(new EventTarget(), {visibilityState:'visible'});
  const target = {document,navigator:{wakeLock:{request}}};
  const phone = {getSnapshot: () => ({demo:false,call:phase ? {phase} : null}),subscribe:(fn: () => undefined) => {listener=fn;return () => undefined;}};
  const cleanup = bindCallWakeLock(phone as unknown as PhoneController,target as unknown as Window);
  return {document,request,sentinel,cleanup,end: () => {phase=undefined;listener();},resolve: () => resolve(sentinel)};
}
describe('foreground call screen wake lock', () => {
  it('releases the lock at hangup and on cleanup', async () => {
    const h=setup();await Promise.resolve();h.end();
    expect(h.request).toHaveBeenCalledWith('screen');expect(h.sentinel.release).toHaveBeenCalledTimes(1);h.cleanup();
  });
  it('does not retain a late lock after hangup', async () => {
    const h=setup(true);h.end();h.resolve();await Promise.resolve();
    expect(h.sentinel.release).toHaveBeenCalledTimes(1);h.cleanup();
  });
  it('releases when hidden, and can acquire again on return', async () => {
    const h=setup();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    h.document.visibilityState='hidden';h.document.dispatchEvent(new Event('visibilitychange'));
    expect(h.sentinel.release).toHaveBeenCalledTimes(1);
    h.document.visibilityState='visible';h.document.dispatchEvent(new Event('visibilitychange'));
    expect(h.request).toHaveBeenCalledTimes(2);h.cleanup();
  });
});
