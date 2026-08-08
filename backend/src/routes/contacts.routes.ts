import { Router } from 'express';
import {
  getAllContacts,
  getContact,
  upsertContact,
  deleteContact,
  submitContactForm,
  listSubmissions,
} from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public - anyone can read contacts (for frontend display)
router.get('/', getAllContacts);
// Public - submit the contact / port-request form (rate limited)
router.post('/submit', apiLimiter, submitContactForm);
// Admin - review submissions
router.get('/submissions', authMiddleware, listSubmissions);
router.get('/:department/:locationId', getContact);

// Protected - admin only for mutations
router.put('/:department/:locationId', authMiddleware, upsertContact);
router.delete('/:department/:locationId', authMiddleware, deleteContact);

export default router;
