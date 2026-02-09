import { Router } from 'express';
import { 
  getDocuments, 
  getDocument, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  signDocument,
  generateDocument,
  downloadDocument
} from '../controllers/document.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// IMPORTANT: Specific routes MUST come before generic /:id routes
// Otherwise /:id will match everything

// Document Generation (must be before /:id)
router.post('/generate', generateDocument);

// Basic CRUD
router.get('/', getDocuments);
router.post('/', createDocument);

// Download (must be before /:id)
router.get('/:id/download', downloadDocument);

// E-Signature (must be before /:id)
router.post('/:id/sign', signDocument);

// Generic ID routes (must be LAST)
router.get('/:id', getDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', authorize('admin', 'sales_manager'), deleteDocument);

export default router;