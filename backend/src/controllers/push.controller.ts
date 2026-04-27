// backend/src/controllers/push.controller.ts
// Handles push subscription registration and VAPID public key endpoint

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { saveSubscription, VAPID_PUBLIC_KEY } from '../utils/webpush';
import { prisma } from '../utils/prisma';

// GET /api/push/vapid-public-key
// Frontend calls this to get the public key needed for PushManager.subscribe()
export const getVapidPublicKey = async (_req: AuthRequest, res: Response) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured on server' });
  }
  return res.json({ vapidPublicKey: VAPID_PUBLIC_KEY });
};

// POST /api/push/subscribe
// Body: { subscription: PushSubscription }
// Agent calls this after they allow notifications — stores their device subscription in DB
export const subscribePush = async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid push subscription object' });
    }

    const userId = req.user!.userId;
    await saveSubscription(userId, subscription);

    console.log(`[Push] User ${userId} subscribed for push notifications`);
    return res.json({ success: true, message: 'Push subscription saved' });

  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
};

// DELETE /api/push/unsubscribe
// Body: { endpoint: string }
// Called when user denies notifications or logs out — removes their device subscription
export const unsubscribePush = async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user!.userId },
    });

    console.log(`[Push] User ${req.user!.userId} unsubscribed endpoint`);
    return res.json({ success: true });

  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    return res.status(500).json({ error: 'Failed to remove push subscription' });
  }
};
