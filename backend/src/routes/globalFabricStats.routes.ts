import { Router } from 'express';
import { getGlobalFabricStats, updateGlobalFabricStats } from '../controllers/globalFabricStats.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read stats (for frontend display)
router.get('/', getGlobalFabricStats);

// Protected - only admin can update
router.put('/', authMiddleware, updateGlobalFabricStats);

export default router;
