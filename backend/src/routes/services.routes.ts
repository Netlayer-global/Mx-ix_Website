import { Router } from 'express';
import {
  getAllServices,
  getService,
  createService,
  updateService,
  deleteService,
  addServiceItem,
  updateServiceItem,
  deleteServiceItem,
} from '../controllers/services.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read services (for frontend display)
router.get('/', getAllServices);
router.get('/:id', getService);

// Protected - admin only for mutations
router.post('/', authMiddleware, createService);
router.put('/:id', authMiddleware, updateService);
router.delete('/:id', authMiddleware, deleteService);

// Service items (nested)
router.post('/:id/items', authMiddleware, addServiceItem);
router.put('/:id/items/:itemIndex', authMiddleware, updateServiceItem);
router.delete('/:id/items/:itemIndex', authMiddleware, deleteServiceItem);

export default router;
