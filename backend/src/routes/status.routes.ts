import { Router } from 'express';
import {
  getStatus,
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  createIncident,
  updateIncident,
  deleteIncident,
  subscribe,
  unsubscribe,
  getSubscribers,
  deleteSubscriber,
} from '../controllers/status.controller';
import { authMiddleware } from '../middleware';
import { apiLimiter, publicReadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public — read-only and rate limited. The handler sets a short Cache-Control.
router.get('/', publicReadLimiter, getStatus);
router.post('/subscribe', apiLimiter, subscribe);
// Unsubscribe is reached by clicking a link in an email, so GET must work.
router.get('/unsubscribe', apiLimiter, unsubscribe);
router.post('/unsubscribe', apiLimiter, unsubscribe);

// Admin — components
router.get('/components', authMiddleware, listComponents);
router.post('/components', authMiddleware, createComponent);
router.put('/components/:id', authMiddleware, updateComponent);
router.delete('/components/:id', authMiddleware, deleteComponent);

// Admin — incidents
router.post('/incidents', authMiddleware, createIncident);
router.put('/incidents/:id', authMiddleware, updateIncident);
router.delete('/incidents/:id', authMiddleware, deleteIncident);

// Admin — subscribers
router.get('/subscribers', authMiddleware, getSubscribers);
router.delete('/subscribers/:id', authMiddleware, deleteSubscriber);

export default router;
