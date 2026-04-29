// backend/src/utils/webpush.ts
// Handles real browser Web Push notifications (works even when PWA tab is closed)
// Subscriptions are persisted to the database so they survive server restarts.

import webpush from 'web-push';
import { prisma } from './prisma';

// ── VAPID Config ───────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL       = process.env.VAPID_EMAIL || 'mailto:admin@ramarealty.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] ✅ VAPID configured');
} else {
  console.warn('[WebPush] ⚠️  VAPID keys not set — push notifications disabled');
}

// ── Save or Update a Push Subscription (DB-backed) ────────────────────────
// Called when an agent's browser subscribes for the first time, or re-subscribes.
export async function saveSubscription(
  userId: string,
  subscription: webpush.PushSubscription
) {
  const { endpoint, keys } = subscription as any;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    console.warn('[WebPush] saveSubscription: invalid subscription object — missing keys');
    return;
  }

  // Upsert by endpoint — avoids duplicates if the same browser re-subscribes
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth:   keys.auth,
    },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth:   keys.auth,
    },
  });

  console.log(`[WebPush] Subscription saved/updated for user: ${userId}`);
}

// ── Send Push Notification to a Specific User ──────────────────────────────
// Looks up all registered devices for that user and sends to all of them.
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const rows = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (rows.length === 0) {
    console.log(`[WebPush] No subscriptions for user ${userId} — skipping push`);
    return;
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url  || '/leads',
    tag:   payload.tag  || 'crm-notification',
  });

  const results = await Promise.allSettled(
    rows.map(row =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        pushPayload
      )
    )
  );

  // Clean up stale subscriptions:
  //   410 Gone  → user explicitly unsubscribed in browser
  //   404       → endpoint no longer exists
  //   400/401   → invalid/expired subscription ("Received unexpected response code")
  const staleEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as any;
      const statusCode = err?.statusCode;
      console.warn(`[WebPush] Push failed for user ${userId} (HTTP ${statusCode ?? 'unknown'}):`, err?.message || err);
      if (statusCode === 410 || statusCode === 404 || statusCode === 400 || statusCode === 401) {
        staleEndpoints.push(rows[i].endpoint);
        console.log(`[WebPush] Marking endpoint as stale (${statusCode}) — will delete from DB`);
      }
    }
  });

  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
    console.log(`[WebPush] Cleaned up ${staleEndpoints.length} stale subscription(s)`);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[WebPush] Sent push to ${userId}: "${payload.title}" → ${sent}/${rows.length} device(s)`);
}

export { VAPID_PUBLIC_KEY };
