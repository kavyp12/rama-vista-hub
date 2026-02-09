import { Router } from 'express';
import { 
  register, 
  login, 
  logout, 
  getCurrentUser,
  refreshToken,
  updateProfile,
  changePassword
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Protected routes (authentication required)
router.use(authenticate);
router.post('/logout', logout);
router.get('/me', getCurrentUser);
router.patch('/profile', updateProfile);
router.patch('/change-password', changePassword);

export default router;