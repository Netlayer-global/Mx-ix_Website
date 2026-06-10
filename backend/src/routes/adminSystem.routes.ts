import { Router } from 'express';
import {
  listAudit,
  listAnnouncements,
  createAnnouncement,
  listTemplates,
  upsertTemplate,
  deleteTemplate,
  nocDashboard,
} from '../controllers/adminSystem.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

// Audit log — super-admin
router.get('/audit', adminRoleMiddleware('super-admin'), listAudit);

// Announcements — super-admin or NOC
router.get('/announcements', adminRoleMiddleware('super-admin', 'noc'), listAnnouncements);
router.post('/announcements', adminRoleMiddleware('super-admin', 'noc'), createAnnouncement);

// Email templates — super-admin
router.get('/email-templates', adminRoleMiddleware('super-admin'), listTemplates);
router.put('/email-templates', adminRoleMiddleware('super-admin'), upsertTemplate);
router.delete('/email-templates/:id', adminRoleMiddleware('super-admin'), deleteTemplate);

// NOC operations dashboard — NOC or super-admin
router.get('/noc', adminRoleMiddleware('noc', 'super-admin'), nocDashboard);

export default router;
