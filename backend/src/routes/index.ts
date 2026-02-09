import { Router } from 'express';
import authRoutes from './auth.routes';
import leadRoutes from './lead.routes';
import propertyRoutes from './property.routes';
import projectRoutes from './project.routes';
import dealRoutes from './deal.routes';
import paymentRoutes from './payment.routes';
import siteVisitRoutes from './siteVisit.routes';
import callLogRoutes from './callLog.routes';
import documentRoutes from './document.routes';
import campaignRoutes from './campaign.routes';
import activityRoutes from './activity.routes';
import syncRoutes from './sync.routes';
import userRoutes from './user.routes'; // ✅ ADD THIS
import brokerRoutes from './broker.routes';
import uploadRoutes from './upload.routes'; 

const router = Router();

router.use('/auth', authRoutes);
router.use('/sync', syncRoutes);
router.use('/users', userRoutes); // ✅ ADD THIS

// Standard routes
router.use('/leads', leadRoutes);
router.use('/properties', propertyRoutes);
router.use('/projects', projectRoutes);
router.use('/brokers', brokerRoutes);
router.use('/uploads', uploadRoutes); 
router.use('/deals', dealRoutes);
router.use('/payments', paymentRoutes);
router.use('/site-visits', siteVisitRoutes);
router.use('/call-logs', callLogRoutes);
router.use('/documents', documentRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/activities', activityRoutes);

export default router;