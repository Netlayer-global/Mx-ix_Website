import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import pp from '../controllers/adminPatchPanels.controller';

/** Patch panels & cross-connect lifecycle. NOC-level access. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/stats', pp.stats);
router.get('/', pp.listPanels);
router.post('/', pp.createPanel);
router.put('/:id', pp.updatePanel);
router.delete('/:id', pp.deletePanel);

// Ports on a panel
router.get('/:id/ports', pp.listPorts);
router.post('/:id/ports/assign', pp.assignPort);
router.put('/:id/ports/:portId', pp.updatePort);

export default router;
