import { Router } from 'express';
import {
  getAllContinents,
  getContinent,
  createContinent,
  updateContinent,
  deleteContinent,
} from '../controllers/continents.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read continents (for frontend display)
router.get('/', getAllContinents);
router.get('/:id', getContinent);

// Protected - admin only for mutations
router.post('/', authMiddleware, createContinent);
router.put('/:id', authMiddleware, updateContinent);
router.delete('/:id', authMiddleware, deleteContinent);

export default router;
