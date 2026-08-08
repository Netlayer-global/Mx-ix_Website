import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import bird from '../controllers/adminBird.controller';

/**
 * Route servers: config generation, deployment, history and the IRRDB cache.
 *
 * The router is NOC-level, but individual handlers escalate to super-admin for
 * anything that changes what the backend executes (deploy transport settings),
 * forces past a safety check, reveals BGP passwords, or rolls a route server
 * back.
 */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

// Fabric-wide status board.
router.get('/status', bird.status);

// IRRDB cache — declared before `/:id` so "irrdb" isn't read as an id.
router.get('/irrdb', bird.irrdbStatus);
router.post('/irrdb/refresh', bird.irrdbRefreshAll);
router.get('/irrdb/:asn', bird.irrdbGetAsn);
router.post('/irrdb/:asn/refresh', bird.irrdbRefreshOne);
router.post('/irrdb/:asn/manual', bird.irrdbSetManual);

// Bulk deploys.
router.post('/deploy-all', bird.deployAll);
router.post('/infrastructures/:id/deploy', bird.deployInfrastructure);

// Individual deployment records.
router.get('/deployments/:deploymentId', bird.getDeployment);
router.post('/deployments/:deploymentId/rollback', bird.rollback);

// Route servers.
router.get('/route-servers', bird.listRouteServers);
router.post('/route-servers', bird.createRouteServer);
router.get('/route-servers/:id/config', bird.previewConfig);
router.post('/route-servers/:id/deploy', bird.deployOne);
router.get('/route-servers/:id/history', bird.deploymentHistory);
router.post('/route-servers/:id/test', bird.testConnection);
router.put('/route-servers/:id', bird.updateRouteServer);
router.delete('/route-servers/:id', bird.deleteRouteServer);

export default router;
