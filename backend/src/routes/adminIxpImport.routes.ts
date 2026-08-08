import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import ixpImport from '../controllers/adminIxpImport.controller';

/** IXP Manager one-time import + retirement. Super-admin only. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('super-admin'));

router.post('/run', ixpImport.runImport);
router.post('/retire', ixpImport.retire);

export default router;
