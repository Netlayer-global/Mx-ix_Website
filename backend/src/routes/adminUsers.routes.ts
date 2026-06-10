import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/adminUsers.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';

const router = Router();

// Admin user management — super-admin (and legacy 'admin') only.
router.use(authMiddleware, adminRoleMiddleware('super-admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
