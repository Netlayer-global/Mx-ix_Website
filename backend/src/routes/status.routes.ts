import { Router } from 'express';
import {
  getStatus,
  createComponent,
  updateComponent,
  deleteComponent,
  createIncident,
  updateIncident,
  deleteIncident,
  subscribe,
  getSubscribers,
} from '../controllers/status.controller';
import { authMiddleware } from '../middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public
router.get('/', getStatus);
router.post('/subscribe', apiLimiter, subscribe);

// Admin — components
router.post('/components', authMiddleware, createComponent);
router.put('/components/:id', authMiddleware, updateComponent);
router.delete('/components/:id', authMiddleware, deleteComponent);

// Admin — incidents
router.post('/incidents', authMiddleware, createIncident);
router.put('/incidents/:id', authMiddleware, updateIncident);
router.delete('/incidents/:id', authMiddleware, deleteIncident);

// Admin — subscribers
router.get('/subscribers', authMiddleware, getSubscribers);

export default router;
