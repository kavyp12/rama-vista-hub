// src/lib/usePushSubscription.ts
// Handles Web Push subscription lifecycle:
// 1. Requests notification permission
// 2. Fetches VAPID public key from backend
// 3. Subscribes this browser/device to push notifications
// 4. Saves subscription to backend DB so server can push to this device even after restart

import { useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Convert a base64 VAPID public key to the Uint8Array format required by the Push API
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(token?: string | null) {
  useEffect(() => {
    if (!token) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push API not supported in this browser');
      return;
    }

    let currentEndpoint: string | null = null;

    const setupPush = async () => {
      try {
        // Step 1: Check/request permission
        let permission = Notification.permission;
        if (permission === 'denied') {
          console.log('[Push] Notification permission denied by user');
          return;
        }
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
          console.log('[Push] Notification permission not granted');
          return;
        }

        // Step 2: Get the service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Step 3: Check if already subscribed to avoid re-subscribing
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Step 4: Fetch VAPID public key from our backend
          const keyRes = await fetch(`${API_URL}/push/vapid-public-key`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!keyRes.ok) {
            console.warn('[Push] Could not fetch VAPID key — server may not support push');
            return;
          }

          const { vapidPublicKey } = await keyRes.json();

          // Step 5: Subscribe this device
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any
          });

          console.log('[Push] ✅ New push subscription created');
        } else {
          console.log('[Push] ✅ Already subscribed — re-registering with backend');
        }

        currentEndpoint = subscription.endpoint;

        // Step 6: Save subscription to backend DB (persists across server restarts)
        await fetch(`${API_URL}/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subscription: subscription.toJSON() })
        });

        console.log('[Push] ✅ Subscription registered with backend DB');

      } catch (error) {
        console.warn('[Push] Setup failed (expected on HTTP/non-HTTPS):', error);
      }
    };

    // Give SW time to activate first before subscribing
    const timer = setTimeout(setupPush, 2000);

    return () => {
      clearTimeout(timer);
      // Note: We do NOT unsubscribe on unmount — subscriptions should persist
      // across page navigations. Unsubscribe only happens on logout (see below).
    };
  }, [token]);
}


