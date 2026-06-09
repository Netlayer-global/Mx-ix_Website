import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  testGrafana,
  testZabbix,
} from '../controllers/settings.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// All settings routes are admin-protected
router.get('/', authMiddleware, getSettings);
router.put('/', authMiddleware, updateSettings);
router.post('/test/grafana', authMiddleware, testGrafana);
router.post('/test/zabbix', authMiddleware, testZabbix);

export default router;
