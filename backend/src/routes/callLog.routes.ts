import { Router } from 'express';
import { 
  createCallLog, 
  getCallLogs, 
  getCallStats, 
  updateCallLog, 
  deleteCallLog 
} from '../controllers/callLog.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create call log
router.post('/', createCallLog);

// Get call logs
router.get('/', getCallLogs);

// Get call statistics
router.get('/stats', getCallStats);

// ✅ NEW: Update call log (Archive)
router.patch('/:id', updateCallLog);

// ✅ NEW: Delete call log (Soft Delete)
router.delete('/:id', deleteCallLog);

export default router;