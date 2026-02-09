import { Router } from 'express';
import { 
  getProperties, 
  getProperty, 
  createProperty, 
  updateProperty, 
  deleteProperty 
} from '../controllers/property.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getProperties);
router.get('/:id', getProperty);
router.post('/', authorize('admin', 'sales_manager'), createProperty);
router.patch('/:id', authorize('admin', 'sales_manager'), updateProperty);
router.delete('/:id', authorize('admin'), deleteProperty);

export default router;