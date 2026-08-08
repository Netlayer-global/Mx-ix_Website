import { Router } from 'express';
import { listOrders, updateOrder, ixpMembers } from '../controllers/adminOrders.controller';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', listOrders);
router.put('/:id', updateOrder);
// IXP Manager preview lives here for convenience
router.get('/ixpmanager/members', ixpMembers);

export default router;
