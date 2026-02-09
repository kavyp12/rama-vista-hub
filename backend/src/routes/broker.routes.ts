import { Router } from 'express';
import { getBrokers, createBroker, deleteBroker } from '../controllers/broker.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Only Admins and Managers should manage brokers
router.get('/', getBrokers);
router.post('/', authorize('admin', 'sales_manager'), createBroker);
router.delete('/:id', authorize('admin'), deleteBroker);

export default router;