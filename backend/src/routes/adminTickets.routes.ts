import { Router } from 'express';
import { listTickets, getTicket, replyTicket, updateTicket } from '../controllers/adminTickets.controller';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', listTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyTicket);
router.put('/:id', updateTicket);

export default router;
