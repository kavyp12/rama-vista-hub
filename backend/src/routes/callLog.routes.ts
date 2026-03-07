import { Router } from 'express';
import {
  createCallLog,
  getCallLogs,
  getCallStats,
  updateCallLog,
  deleteCallLog,
  initiateMcubeCall,
  mcubeWebhook,
  mcubeRouting
} from '../controllers/callLog.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// --- NO AUTH REQUIRED FOR WEBHOOK ---
// MCUBE will post data here when a call is disconnected
router.post('/mcube-webhook', mcubeWebhook);
// MCUBE will call this dynamically when a call first arrives to find out who to route to
router.get('/mcube-route', mcubeRouting);
router.post('/mcube-route', mcubeRouting);

// --- ALL ROUTES BELOW REQUIRE AUTHENTICATION ---
router.use(authenticate);

// NEW: Endpoint for React to trigger an MCUBE call
router.post('/initiate-mcube', initiateMcubeCall);

// Existing Routes
router.post('/', createCallLog);
router.get('/', getCallLogs);
router.get('/stats', getCallStats);
router.patch('/:id', updateCallLog);
router.delete('/:id', deleteCallLog);

export default router;