import { Router } from 'express';
import { 
  getLeads, getLead, createLead, updateLead, deleteLead,
  recommendProperties, logCall, 
  getAgentDashboardStats
} from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getLeads);
router.get('/:id', getLead);
router.post('/', createLead);
router.patch('/:id', updateLead);
router.delete('/:id', deleteLead);

// ✅ NEW ROUTES
router.post('/:id/recommendations', recommendProperties);
router.get('/dashboard/stats', getAgentDashboardStats);
router.post('/:id/call-logs', logCall);

export default router;