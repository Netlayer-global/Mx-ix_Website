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

export default router;
