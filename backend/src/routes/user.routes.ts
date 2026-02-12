import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getUsers,
  getUser,
  getUserStats,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  getUserCallLogs
} from '../controllers/user.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all users (Admin/Manager only)
router.get('/', getUsers);

// Get single user details
router.get('/:id', getUser);

// Get user statistics
router.get('/:id/stats', getUserStats);

// Get user call logs
router.get('/:id/call-logs', getUserCallLogs);

// Create new user (Admin only)
router.post('/', createUser);

// Update user (Admin can update anyone, users can update self with limited fields)
router.patch('/:id', updateUser);

// Reset user password (Admin only)
router.patch('/:id/reset-password', resetUserPassword);

// Delete/Deactivate user (Admin only)
router.delete('/:id', deleteUser);

export default router;