import { Router } from 'express';
import { getNetworkStats, updateNetworkStats } from '../controllers/networkStats.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read stats (for frontend display)
router.get('/', getNetworkStats);

// Protected - only admin can update
router.put('/', authMiddleware, updateNetworkStats);

export default router;
