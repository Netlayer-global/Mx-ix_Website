import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import { p95BillingRun } from '../controllers/adminBilling.controller';
import { slaReport } from '../controllers/adminSlaReport.controller';

/** Billing utilities — 95th-percentile reporting, SLA reports and Zoho export. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc', 'billing'));

router.get('/p95-run', p95BillingRun);
router.get('/sla-report', slaReport);

export default router;
