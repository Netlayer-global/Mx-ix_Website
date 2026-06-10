import { Router } from 'express';
import authRoutes from './auth.routes';
import networkStatsRoutes from './networkStats.routes';
import globalFabricStatsRoutes from './globalFabricStats.routes';
import servicesRoutes from './services.routes';
import locationsRoutes from './locations.routes';
import contactsRoutes from './contacts.routes';
import continentsRoutes from './continents.routes';
import grafanaRoutes from './grafana.routes';
import statsRoutes from './stats.routes';
import settingsRoutes from './settings.routes';
import lgRoutes from './lg.routes';
import statusRoutes from './status.routes';
import membersRoutes from './members.routes';
import portalRoutes from './portal.routes';
import adminCustomersRoutes from './adminCustomers.routes';
import adminOrdersRoutes from './adminOrders.routes';
import adminTicketsRoutes from './adminTickets.routes';
import adminMaintenanceRoutes from './adminMaintenance.routes';
import adminUsersRoutes from './adminUsers.routes';
import adminSystemRoutes from './adminSystem.routes';
import adminIxpRoutes from './adminIxp.routes';
import adminRouteServersRoutes from './adminRouteServers.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'MX-IX Admin API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/network-stats', networkStatsRoutes);
router.use('/global-fabric-stats', globalFabricStatsRoutes);
router.use('/services', servicesRoutes);
router.use('/locations', locationsRoutes);
router.use('/contacts', contactsRoutes);
router.use('/continents', continentsRoutes);
router.use('/grafana', grafanaRoutes);
router.use('/stats', statsRoutes);
router.use('/settings', settingsRoutes);
router.use('/lg', lgRoutes);
router.use('/status', statusRoutes);
router.use('/members', membersRoutes);
router.use('/portal', portalRoutes);
router.use('/admin/customers', adminCustomersRoutes);
router.use('/admin/orders', adminOrdersRoutes);
router.use('/admin/tickets', adminTicketsRoutes);
router.use('/admin/maintenance', adminMaintenanceRoutes);
router.use('/admin/users', adminUsersRoutes);
router.use('/admin/system', adminSystemRoutes);
router.use('/admin/ixp', adminIxpRoutes);
router.use('/admin/route-servers', adminRouteServersRoutes);

export default router;
