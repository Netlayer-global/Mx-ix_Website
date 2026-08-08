import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import vlans from '../controllers/adminVlans.controller';

/** VLANs and the IP address pools allocated from them. NOC-level access. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/', vlans.listVlans);
router.post('/', vlans.createVlan);

// Pool operations, declared before the bare `/:id` routes.
router.get('/:id/pool', vlans.poolStats);
router.post('/:id/pool/seed', vlans.seedPool);
router.get('/:id/addresses', vlans.listAddresses);
router.post('/:id/addresses/:addressId/reserved', vlans.setAddressReserved);

router.put('/:id', vlans.updateVlan);
router.delete('/:id', vlans.deleteVlan);

export default router;
