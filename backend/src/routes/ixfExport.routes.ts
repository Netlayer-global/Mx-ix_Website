import { Router } from 'express';
import { ixfMemberExport } from '../controllers/ixfExport.controller';

/**
 * Public IX-F Member Export (JSON).
 *
 * Serves the Euro-IX JSON Member List (schema 1.0) at:
 *   GET /api/ix-f/member-export/1.0
 *
 * This is the industry-standard machine-readable format consumed by PeeringDB,
 * IXP tooling, and automated peering decision engines. It is intentionally
 * unauthenticated.
 */
const router = Router();

router.get('/member-export/1.0', ixfMemberExport);
// Alias without version for convenience
router.get('/member-export', ixfMemberExport);

export default router;
