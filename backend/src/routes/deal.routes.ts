import { Router } from 'express';
import { 
  getDeals, 
  getDeal, 
  createDeal, 
  updateDeal, 
  deleteDeal 
} from '../controllers/deal.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getDeals);
router.get('/:id', getDeal);
router.post('/', createDeal);
router.patch('/:id', updateDeal);
router.delete('/:id', deleteDeal);

export default router;