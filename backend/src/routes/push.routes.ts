// backend/src/routes/push.routes.ts
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../controllers/push.controller';

const router = Router();

// GET /api/push/vapid-public-key — returns the public VAPID key to the frontend
router.get('/vapid-public-key', authenticate, getVapidPublicKey);

// POST /api/push/subscribe — saves a device's push subscription for the logged-in user
router.post('/subscribe', authenticate, subscribePush);

// DELETE /api/push/unsubscribe — removes a device's push subscription from the DB
router.delete('/unsubscribe', authenticate, unsubscribePush);

export default router;
