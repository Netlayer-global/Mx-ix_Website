import { Router } from 'express';
import {
  getConfig,
  getRouteservers,
  getStatus,
  getNeighbors,
  getRoutes,
  lookup,
  lookupNeighbors,
} from '../controllers/lg.controller';

const router = Router();

// Public read-only Looking Glass proxy endpoints
router.get('/config', getConfig);
router.get('/routeservers', getRouteservers);
router.get('/lookup', lookup);
router.get('/lookup/neighbors', lookupNeighbors);
router.get('/routeservers/:id/status', getStatus);
router.get('/routeservers/:id/neighbors', getNeighbors);
router.get('/routeservers/:id/neighbors/:neighborId/routes', getRoutes);
router.get('/routeservers/:id/neighbors/:neighborId/routes/:filter', getRoutes);

export default router;
