import { Router } from 'express';
import { authMiddleware } from '../middleware';
import promo from '../controllers/sitePromo.controller';

/**
 * Site-wide announcement (headline bar + entry popup).
 * Reads are public so the website can render them; writes require an admin.
 */
const router = Router();

router.get('/', promo.getPublicPromo);
router.get('/image', promo.getPromoImage);

router.get('/admin', authMiddleware, promo.getAdminPromo);
router.put('/', authMiddleware, promo.updatePromo);

export default router;
