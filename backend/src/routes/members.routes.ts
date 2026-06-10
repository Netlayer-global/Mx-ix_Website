import { Router } from 'express';
import {
  getMembers,
  getAllMembers,
  createMember,
  updateMember,
  deleteMember,
} from '../controllers/members.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public
router.get('/', getMembers);

// Admin
router.get('/all', authMiddleware, getAllMembers);
router.post('/', authMiddleware, createMember);
router.put('/:id', authMiddleware, updateMember);
router.delete('/:id', authMiddleware, deleteMember);

export default router;
