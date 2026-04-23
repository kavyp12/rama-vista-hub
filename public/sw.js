// public/sw.js
// Service Worker — handles background push notifications for PWA (installed desktop mode)

const CACHE_NAME = 'rama-crm-v1';

// Install — cache shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ─── Push Notification Handler ────────────────────────────────────────────
// This fires even when the app tab is closed (installed PWA mode)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || '📋 New Lead Assigned', {
      body: data.body || 'You have a new lead.',
      icon: '/rama_R_logo.png',
      badge: '/rama_R_logo.png',
      tag: data.tag || 'lead-assigned',
      renotify: true,
      data: { url: data.url || '/leads' }
    })
  );
});

// ─── Notification Click Handler ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/leads';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing open tab if found
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});