import { Router } from 'express';
import { 
  getActivityLogs, 
  getActivityLog, 
  getRecentActivity,
  getActivityStats,
  deleteActivityLog 
} from '../controllers/activity.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getActivityLogs);
router.get('/recent', getRecentActivity);
router.get('/stats', getActivityStats);
router.get('/:id', getActivityLog);
router.delete('/:id', authorize('admin'), deleteActivityLog);

export default router;