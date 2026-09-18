import { Router } from 'express';
import mongoose from 'mongoose';
import { publicReadLimiter } from '../middleware/rateLimit.middleware';
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
import sitePromoRoutes from './sitePromo.routes';
import ixfExportRoutes from './ixfExport.routes';
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
import adminBillingRoutes from './adminBilling.routes';
// Native IXP fabric management (replaces the IXP Manager dependency)
import adminFabricRoutes from './adminFabric.routes';
import adminVlansRoutes from './adminVlans.routes';
import adminPeersRoutes from './adminPeers.routes';
import adminBirdRoutes from './adminBird.routes';
import adminPeeringDbRoutes from './adminPeeringDb.routes';
import adminPatchPanelsRoutes from './adminPatchPanels.routes';
import adminCoreBundlesRoutes from './adminCoreBundles.routes';
import adminExportsRoutes from './adminExports.routes';
import adminApiTokensRoutes from './adminApiTokens.routes';
import adminIxpImportRoutes from './adminIxpImport.routes';

const router = Router();

/**
 * Health check — reports real dependency state, not just process liveness.
 *
 * Returns 503 when a hard dependency (the database) is unavailable so load
 * balancers and uptime monitors see the failure instead of a cheerful 200.
 */
router.get('/health', async (_req, res) => {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; detail?: string; ms?: number }> = {};

  // Database — 1 = connected in Mongoose's readyState enum.
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    try {
      const t = Date.now();
      await mongoose.connection.db!.admin().ping();
      checks.database = { ok: true, ms: Date.now() - t };
    } catch (err: any) {
      checks.database = { ok: false, detail: err?.message || 'ping failed' };
    }
  } else {
    const states: Record<number, string> = { 0: 'disconnected', 2: 'connecting', 3: 'disconnecting' };
    checks.database = { ok: false, detail: states[dbState] || `readyState ${dbState}` };
  }

  // Soft dependencies: reported, but do not fail the health check.
  try {
    const { getEffectiveMail, getEffectiveGrafana } = await import('../models/settings.model');
    const [mail, grafana] = await Promise.all([
      getEffectiveMail().catch(() => null),
      getEffectiveGrafana().catch(() => null),
    ]);
    checks.smtp = { ok: !!mail?.configured, detail: mail?.configured ? mail.source : 'not configured' };
    checks.monitoring = { ok: !!grafana?.enabled, detail: grafana?.enabled ? 'grafana' : 'not configured' };
  } catch {
    /* settings unreadable — the database check already covers it */
  }

  const healthy = checks.database?.ok === true;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'MX-IX API is healthy' : 'MX-IX API is degraded',
    checks,
    uptimeSeconds: Math.round(process.uptime()),
    responseMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  });
});

// IX-F Member Export (public, no auth — the standard requires this to be open)
import { ixfExport } from '../controllers/ixfExport.controller';
router.get('/ixf-export', ixfExport);

// Peering Matrix (public — traditionally published openly)
import { getPeeringMatrix } from '../controllers/peeringMatrix.controller';
router.get('/peering-matrix', getPeeringMatrix);

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
router.use('/site-promo', sitePromoRoutes);
router.use('/ix-f', ixfExportRoutes);

// Public: upcoming maintenance windows (consumed by portal and status page)
import { upcomingWindows } from '../controllers/adminMaintenanceWindows.controller';
router.get('/maintenance/upcoming', publicReadLimiter, upcomingWindows as any);
router.use('/members', membersRoutes);
router.use('/portal', portalRoutes);
router.use('/admin/customers', adminCustomersRoutes);
router.use('/admin/orders', adminOrdersRoutes);
router.use('/admin/tickets', adminTicketsRoutes);
router.use('/admin/maintenance', adminMaintenanceRoutes);
router.use('/admin/users', adminUsersRoutes);
router.use('/admin/system', adminSystemRoutes);
router.use('/admin/ixp', adminIxpRoutes);
// Legacy: Alice-LG source registry + alice.conf generation.
router.use('/admin/route-servers', adminRouteServersRoutes);
router.use('/admin/billing', adminBillingRoutes);

// ── Native IXP fabric ──
// /admin/fabric    → infrastructures, facilities, cabinets, devices, ports
// /admin/vlans     → VLANs + IP address pools
// /admin/peers     → member connections, peers, MACs, provisioning
// /admin/bird      → route-server config generation, deployment, IRRDB
// /admin/peeringdb → PeeringDB lookups, sync and reconciliation
router.use('/admin/fabric', adminFabricRoutes);
router.use('/admin/vlans', adminVlansRoutes);
router.use('/admin/peers', adminPeersRoutes);
router.use('/admin/bird', adminBirdRoutes);
router.use('/admin/peeringdb', adminPeeringDbRoutes);
router.use('/admin/patch-panels', adminPatchPanelsRoutes);
router.use('/admin/core-bundles', adminCoreBundlesRoutes);
router.use('/admin/exports', adminExportsRoutes);
router.use('/admin/api-tokens', adminApiTokensRoutes);
router.use('/admin/ixp-import', adminIxpImportRoutes);

export default router;
