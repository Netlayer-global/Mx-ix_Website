import { Router } from 'express';
import {
  getAllLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationASNs,
  addASN,
  updateASN,
  deleteASN,
  getLocationSites,
  addSite,
  updateSite,
  deleteSite,
} from '../controllers/locations.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public - anyone can read locations (for frontend map/display)
router.get('/', getAllLocations);
router.get('/:id', getLocation);
router.get('/:id/asns', getLocationASNs);
router.get('/:id/sites', getLocationSites);

// Protected - admin only for mutations
router.post('/', authMiddleware, createLocation);
router.put('/:id', authMiddleware, updateLocation);
router.delete('/:id', authMiddleware, deleteLocation);

// ASN management (nested)
router.post('/:id/asns', authMiddleware, addASN);
router.put('/:id/asns/:asnNumber', authMiddleware, updateASN);
router.delete('/:id/asns/:asnNumber', authMiddleware, deleteASN);

// Site management (nested)
router.post('/:id/sites', authMiddleware, addSite);
router.put('/:id/sites/:siteId', authMiddleware, updateSite);
router.delete('/:id/sites/:siteId', authMiddleware, deleteSite);

export default router;
