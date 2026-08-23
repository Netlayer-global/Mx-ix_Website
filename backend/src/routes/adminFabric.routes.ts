import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import fabric from '../controllers/adminFabric.controller';

/**
 * Physical fabric: Infrastructure → Facility → Cabinet → Device → Port.
 *
 * NOC-level access. Static path segments are declared before their `/:id`
 * siblings, which Express 5 requires.
 */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

// Infrastructures
router.get('/infrastructures/dashboard', fabric.ixDashboard);
router.get('/infrastructures/:id/live-stats', fabric.ixLiveStats);
router.get('/infrastructures', fabric.listInfrastructures);
router.post('/infrastructures', fabric.createInfrastructure);
router.put('/infrastructures/:id', fabric.updateInfrastructure);
router.delete('/infrastructures/:id', fabric.deleteInfrastructure);

// Facilities (data centres)
router.get('/facilities', fabric.listFacilities);
router.post('/facilities', fabric.createFacility);
router.put('/facilities/:id', fabric.updateFacility);
router.delete('/facilities/:id', fabric.deleteFacility);

// Cabinets (racks) — `/elevation` before the bare `/:id` routes.
router.get('/cabinets', fabric.listCabinets);
router.post('/cabinets', fabric.createCabinet);
router.get('/cabinets/:id/elevation', fabric.cabinetElevation);
router.put('/cabinets/:id', fabric.updateCabinet);
router.delete('/cabinets/:id', fabric.deleteCabinet);

// Devices (switches) and their ports
router.get('/devices', fabric.listDevices);
router.post('/devices', fabric.createDevice);
router.get('/devices/:id', fabric.getDevice);
router.put('/devices/:id', fabric.updateDevice);
router.delete('/devices/:id', fabric.deleteDevice);

router.post('/devices/:id/ports/generate', fabric.generatePorts);
router.post('/devices/:id/ports', fabric.createPort);
router.put('/devices/:id/ports/:portId', fabric.updatePort);
router.delete('/devices/:id/ports/:portId', fabric.deletePort);

export default router;
