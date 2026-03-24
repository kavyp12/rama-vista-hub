import { Router } from 'express';
import { getIncentiveReport } from '../controllers/incentive.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/incentives/report?dateFrom=&dateTo=&agentId=
router.get('/report', getIncentiveReport);

export default router;
