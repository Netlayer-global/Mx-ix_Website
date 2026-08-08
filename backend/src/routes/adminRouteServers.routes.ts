import { Router } from 'express';
import {
  listRouteServers,
  createRouteServer,
  updateRouteServer,
  deleteRouteServer,
  previewConfig,
  applyConfig,
} from '../controllers/adminRouteServers.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

router.get('/', listRouteServers);
router.post('/', createRouteServer);
router.get('/config', previewConfig);
router.post('/apply', applyConfig);
router.put('/:id', updateRouteServer);
router.delete('/:id', deleteRouteServer);

export default router;
