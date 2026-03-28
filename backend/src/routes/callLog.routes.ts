// import { Router } from 'express';
// import {
//   createCallLog,
//   getCallLogs,
//   getCallStats,
//   updateCallLog,
//   deleteCallLog,
//   initiateMcubeCall,
//   mcubeWebhook,
//   getMissedCallsDetail,
//   completeFollowUpTask,
// } from '../controllers/callLog.controller';
// import { authenticate } from '../middlewares/auth.middleware';


// const router = Router();

// // --- NO AUTH REQUIRED — MCUBE posts here after every call ---
// router.post('/mcube-webhook', mcubeWebhook);

// // --- ALL ROUTES BELOW REQUIRE AUTHENTICATION ---
// router.use(authenticate);

// // Trigger an outbound call via MCUBE (click to call from UI)
// router.post('/initiate-mcube', initiateMcubeCall);

// // Existing Routes
// router.post('/', createCallLog);
// router.get('/', getCallLogs);
// router.get('/stats', getCallStats);
// router.get('/missed-calls', getMissedCallsDetail); // Detailed missed calls for agent UI
// router.patch('/:id', updateCallLog);
// router.delete('/:id', deleteCallLog);
// router.patch('/tasks/:taskId/complete', completeFollowUpTask);

// export default router;


import { Router } from 'express';
import {
  createCallLog,
  getCallLogs,
  getCallStats,
  updateCallLog,
  deleteCallLog,
  initiateMcubeCall,
  mcubeWebhook,
  getMissedCallsDetail,
  completeFollowUpTask,
} from '../controllers/callLog.controller';
import { authenticate } from '../middlewares/auth.middleware';


const router = Router();

// --- NO AUTH REQUIRED — MCUBE posts here after every call ---
router.post('/mcube-webhook', mcubeWebhook);
router.get('/webhook-test', (_req, res) => {
  res.json({ 
    status: 'Webhook route is reachable ✅', 
    url: 'POST /api/call-logs/mcube-webhook',
    time: new Date().toISOString() 
  });
});

// --- ALL ROUTES BELOW REQUIRE AUTHENTICATION ---
router.use(authenticate);

// Trigger an outbound call via MCUBE (click to call from UI)
router.post('/initiate-mcube', initiateMcubeCall);

// Existing Routes
router.post('/', createCallLog);
router.get('/', getCallLogs);
router.get('/stats', getCallStats);
router.get('/missed-calls', getMissedCallsDetail); // Detailed missed calls for agent UI
router.patch('/:id', updateCallLog);
router.delete('/:id', deleteCallLog);
router.patch('/tasks/:taskId/complete', completeFollowUpTask);

export default router;

