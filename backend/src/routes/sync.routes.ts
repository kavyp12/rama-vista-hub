import { Router } from 'express';
import { syncProjects, syncLeads, syncProperties } from '../controllers/sync.controller'; // 👈 Import syncProperties
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Protect all sync routes
router.use(authenticate);

router.post('/projects', syncProjects);
router.post('/leads', syncLeads);
router.post('/properties', syncProperties); // 👈 ADD THIS LINE

export default router;