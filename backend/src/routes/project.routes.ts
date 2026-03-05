import { Router } from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/project.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// ✅ READ routes: Any logged-in user can view projects
router.get('/', getProjects);
router.get('/:id', getProject);

// ✅ FIX C6: Re-add authorize() so only admins/managers can create/update/delete projects
router.post('/', authorize('admin', 'sales_manager'), createProject);
router.patch('/:id', authorize('admin', 'sales_manager'), updateProject);
router.delete('/:id', authorize('admin'), deleteProject);

export default router;