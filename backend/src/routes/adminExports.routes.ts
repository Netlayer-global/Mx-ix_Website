import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import exports from '../controllers/adminExports.controller';

/** Export generators — downloadable configs for DNS, Nagios, TACACS, RIR, MANRS. NOC-level. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/reverse-dns', exports.reverseDns);
router.get('/nagios', exports.nagiosConfig);
router.get('/tacacs', exports.tacacsList);
router.get('/rir-objects', exports.rirObjects);
router.get('/manrs', exports.manrsReport);

export default router;
