import type { PhoneController } from './types';

/** Keep an ongoing foreground call from entering automatic screen sleep. Never override manual locking. */
export function bindCallWakeLock(phone: PhoneController, target: Window) {
  const api = target.navigator?.wakeLock;
  if (!api || !target.document) return () => undefined;
  let lock: WakeLockSentinel | undefined, pending = false, disposed = false;
  const wanted = () => {
    const snapshot = phone.getSnapshot(), call = snapshot.call;
    return !disposed && !snapshot.demo && target.document.visibilityState === 'visible' &&
      !!call && ['dialing', 'ringing-out', 'active', 'held'].includes(call.phase);
  };
  const sync = () => {
    if (!wanted()) {
      const old = lock; lock = undefined;
      if (old) void old.release().catch(() => undefined);
      return;
    }
    if (lock || pending) return;
    pending = true;
    void api.request('screen').then(result => {
      if (!wanted()) { void result.release().catch(() => undefined); return; }
      lock = result;
      result.addEventListener('release', () => { if (lock === result) lock = undefined; });
    }).catch(() => undefined).finally(() => { pending = false; });
  };
  const unsubscribe = phone.subscribe(sync);
  target.document.addEventListener('visibilitychange', sync);
  sync();
  return () => { disposed = true; unsubscribe(); target.document.removeEventListener('visibilitychange', sync); sync(); };
}
