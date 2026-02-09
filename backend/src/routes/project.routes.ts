import { Router } from 'express';
import { 
  getProjects, 
  getProject, 
  createProject, 
  updateProject, 
  deleteProject 
} from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// 1. Keep authentication (user must be logged in)
router.use(authenticate);

// 2. Remove 'authorize(...)' so ANY logged-in user can access these
router.get('/', getProjects);
router.get('/:id', getProject);

// CHANGED: Removed authorize('admin', 'sales_manager')
router.post('/', createProject); 

// CHANGED: Removed authorize('admin', 'sales_manager')
router.patch('/:id', updateProject); 

// CHANGED: Removed authorize('admin')
router.delete('/:id', deleteProject);

export default router;