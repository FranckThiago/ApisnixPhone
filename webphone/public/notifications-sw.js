/* Notifications only: no fetch handler, cache, push subscription or call handling. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const phone = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (phone) await phone.focus();
    else await self.clients.openWindow('/');
  }));
});
