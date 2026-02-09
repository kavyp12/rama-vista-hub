import { Router } from 'express';
import { 
  getSiteVisits, 
  getSiteVisit, 
  createSiteVisit, 
  updateSiteVisit, 
  deleteSiteVisit 
} from '../controllers/siteVisit.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSiteVisits);
router.get('/:id', getSiteVisit);
router.post('/', createSiteVisit);
router.patch('/:id', updateSiteVisit);
router.delete('/:id', deleteSiteVisit);

export default router;