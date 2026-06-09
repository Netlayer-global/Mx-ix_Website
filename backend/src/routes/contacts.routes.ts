import { Router } from 'express';
import {
  getAllContacts,
  getContact,
  upsertContact,
  deleteContact,
} from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read contacts (for frontend display)
router.get('/', getAllContacts);
router.get('/:department/:locationId', getContact);

// Protected - admin only for mutations
router.put('/:department/:locationId', authMiddleware, upsertContact);
router.delete('/:department/:locationId', authMiddleware, deleteContact);

export default router;
