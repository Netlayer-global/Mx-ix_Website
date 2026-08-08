import { Router } from 'express';
import { ixpStatus, ixpMembersPreview, ixpSync, ixpImportPorts } from '../controllers/adminIxp.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/status', ixpStatus);
router.get('/members', ixpMembersPreview);
router.post('/sync', ixpSync);
router.post('/import-ports/:orgId', ixpImportPorts);

export default router;
