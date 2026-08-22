import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import { p95BillingRun } from '../controllers/adminBilling.controller';

/** Billing utilities — 95th-percentile reporting and Zoho export. */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc', 'billing'));

router.get('/p95-run', p95BillingRun);

export default router;
