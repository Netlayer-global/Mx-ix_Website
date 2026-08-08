import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import pdb from '../controllers/adminPeeringDb.controller';

/** PeeringDB lookups, member sync and participant reconciliation. NOC-level. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/status', pdb.status);
router.post('/cache/clear', pdb.clearCache);

router.get('/ix', pdb.searchIx);
router.get('/facilities', pdb.searchFacilities);

router.get('/net/:asn', pdb.lookupAsn);

router.post('/sync-all', pdb.syncAll);
router.post('/sync/:orgId', pdb.syncOrganization);

router.get('/infrastructures/:infrastructureId/participants', pdb.participantDiff);

export default router;
