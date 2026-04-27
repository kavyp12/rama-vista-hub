// public/sw.js
// Service Worker — handles real background Web Push notifications for PWA
// This file runs independently of React — it's always alive even when the app is closed.

const CACHE_NAME = 'rama-crm-v2';

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately without waiting for old SW to die
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Take control of all open tabs immediately
});

// ── Push Event ─────────────────────────────────────────────────────────────
// This fires when the backend sends a real Web Push message via VAPID.
// Works even when the PWA tab is completely closed (true background push).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: '📋 New Notification', body: event.data?.text() || 'You have a new update.' };
  }

  const title = data.title || '📋 New Lead Assigned';
  const options = {
    body: data.body || 'You have a new lead.',
    icon: '/rama_R_logo.png',
    badge: '/rama_R_logo.png',
    tag: data.tag || 'lead-notification',
    renotify: true,                    // Always show even if same tag
    requireInteraction: true,          // Keep on screen until tapped (Android)
    vibrate: [200, 100, 200],          // Vibration pattern on Android
    data: {
      url: data.url || '/leads'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click Handler ─────────────────────────────────────────────
// When the user taps the notification, open/focus the app and navigate to leads.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/leads';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If the PWA window is already open, focus and navigate it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 2. If the app is fully closed, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
