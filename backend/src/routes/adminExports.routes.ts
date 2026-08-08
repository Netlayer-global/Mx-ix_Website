import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
// `exports` is reserved in a module's top-level scope, so the controller is
// imported under a non-conflicting name.
import exportControllers from '../controllers/adminExports.controller';

/** Export generators — downloadable configs for DNS, Nagios, TACACS, RIR, MANRS. NOC-level. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/reverse-dns', exportControllers.reverseDns);
router.get('/nagios', exportControllers.nagiosConfig);
router.get('/tacacs', exportControllers.tacacsList);
router.get('/rir-objects', exportControllers.rirObjects);
router.get('/manrs', exportControllers.manrsReport);

export default router;
