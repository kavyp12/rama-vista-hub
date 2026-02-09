import { Router } from 'express';
import { 
  getPayments, 
  getPayment, 
  createPayment, 
  updatePayment, 
  deletePayment,
  createPaymentSchedule,
  recordPayment,
  getPaymentLedger,
  getOverduePayments,
  sendPaymentReminders
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// IMPORTANT: Specific routes MUST come before generic /:id routes
// Otherwise /:id will match everything

// Payment Schedules (must be before /:id)
router.post('/schedule', createPaymentSchedule);

// Ledger (must be before /:id)
router.get('/ledger/view', getPaymentLedger);

// Overdue Payments (must be before /:id)
router.get('/overdue/list', getOverduePayments);

// Payment Reminders (must be before /:id)
router.post('/reminders/send', sendPaymentReminders);

// Basic CRUD
router.get('/', getPayments);
router.post('/', createPayment);

// Record Payment (must be before generic /:id routes)
router.post('/:id/record', recordPayment);

// Generic ID routes (must be LAST)
router.get('/:id', getPayment);
router.patch('/:id', updatePayment);
router.delete('/:id', authorize('admin'), deletePayment);

export default router;