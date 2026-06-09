import { Router } from 'express';
import { 
  getTrafficStats, 
  getDashboardData, 
  getRealTimeMetrics,
  getStatus,
  getDashboards,
  getHosts
} from '../controllers/grafana.controller';

const router = Router();

// Public endpoints for frontend consumption
router.get('/traffic', getTrafficStats);
router.get('/realtime', getRealTimeMetrics);
router.get('/status', getStatus);
router.get('/dashboards', getDashboards);
router.get('/hosts', getHosts);
router.get('/dashboard/:dashboardId', getDashboardData);

export default router;

