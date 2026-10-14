import type { PhoneSnapshot } from './types';

/** Device permissions stay on this browser, never in the shared line profile. */
const CHOICE = 'apisnixphone-notifications';
const OFFERED = 'apisnixphone-notifications-offered';
let offeredThisPage = false;
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing: session state still works. */ } }

export function notificationsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && read(CHOICE) !== 'off';
}
export function canOfferNotifications() {
  return typeof Notification !== 'undefined' && Notification.permission === 'default' && !offeredThisPage && !read(OFFERED) && read(CHOICE) !== 'off';
}
export function markNotificationsOffered() { offeredThisPage = true; write(OFFERED, 'yes'); }
export function shouldOfferAfterCall(snapshot: Pick<PhoneSnapshot, 'call' | 'demo'>, enabled: boolean) {
  const call = snapshot.call;
  return !snapshot.demo && !enabled && !!call && call.phase === 'ended'
    && (call.direction === 'outbound' || !!call.answeredAt) && canOfferNotifications();
}
export function disableNotifications() { write(CHOICE, 'off'); }

let registration: Promise<ServiceWorkerRegistration> | undefined;
function notificationWorker() {
  registration ??= navigator.serviceWorker.register('/notifications-sw.js').then(async registered => {
    if (registered.active) return registered;
    const worker = registered.installing ?? registered.waiting;
    if (!worker) throw new Error('Notification worker unavailable');
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer); worker.removeEventListener('statechange', changed);
        if (error) reject(error); else resolve();
      };
      const changed = () => {
        if (worker.state === 'activated') finish();
        else if (worker.state === 'redundant') finish(new Error('Notification worker unavailable'));
      };
      const timer = setTimeout(() => finish(new Error('Notification worker timed out')), 8000);
      worker.addEventListener('statechange', changed);
      changed();
    });
    return registered;
  }).catch(error => { registration = undefined; throw error; });
  return registration;
}

/** Called directly from the activation button: browsers require a user gesture. */
export async function enableNotifications(): Promise<NotificationPermission | 'unavailable'> {
  if (typeof Notification === 'undefined') return 'unavailable';
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    markNotificationsOffered();
    if (permission !== 'granted') return permission;
    if ('serviceWorker' in navigator) await notificationWorker();
    write(CHOICE, 'on');
    return 'granted';
  } catch { return 'unavailable'; }
}

/** Mobile browsers need showNotification. This worker neither caches pages nor receives push. */
export function showSystemNotification(title: string, options: NotificationOptions): () => void {
  let cancelled = false;
  let close: (() => void) | undefined;
  if (notificationsEnabled()) void (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const worker = await notificationWorker();
        if (cancelled) return;
        await worker.showNotification(title, { icon: '/apple-touch-icon.png', ...options });
        close = () => { void worker.getNotifications({ tag: options.tag }).then(items => items.forEach(item => item.close())).catch(() => undefined); };
      } else {
        const notification = new Notification(title, options);
        notification.onclick = () => { window.focus(); notification.close(); };
        close = () => notification.close();
      }
      if (cancelled) close?.();
    } catch { /* Notification failure must never interrupt the phone or its ringtone. */ }
  })();
  return () => { cancelled = true; close?.(); };
}
