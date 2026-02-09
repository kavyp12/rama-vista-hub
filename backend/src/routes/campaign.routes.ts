import { Router } from 'express';
import { 
  getCampaigns, 
  getCampaign, 
  createCampaign, 
  updateCampaign, 
  deleteCampaign 
} from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getCampaigns);
router.get('/:id', getCampaign);
router.post('/', authorize('admin', 'sales_manager'), createCampaign);
router.patch('/:id', authorize('admin', 'sales_manager'), updateCampaign);
router.delete('/:id', authorize('admin'), deleteCampaign);

export default router;