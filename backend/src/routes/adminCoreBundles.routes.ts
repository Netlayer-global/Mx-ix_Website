import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import cb from '../controllers/adminCoreBundles.controller';

/** Core bundles — inter-switch links (our own trunks). NOC-level. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/capacity', cb.capacitySummary);
router.get('/', cb.listBundles);
router.post('/', cb.createBundle);
router.put('/:id', cb.updateBundle);
router.delete('/:id', cb.deleteBundle);

// Links within a bundle
router.get('/:id/links', cb.listLinks);
router.post('/:id/links', cb.createLink);
router.put('/:id/links/:linkId', cb.updateLink);
router.delete('/:id/links/:linkId', cb.deleteLink);

export default router;
