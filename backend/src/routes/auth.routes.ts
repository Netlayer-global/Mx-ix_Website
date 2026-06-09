import { Router } from 'express';
import { login, getCurrentUser, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public routes (rate-limited against brute force)
router.post('/login', authLimiter, login);

// Protected routes
router.get('/me', authMiddleware, getCurrentUser);
router.put('/password', authMiddleware, changePassword);

export default router;
