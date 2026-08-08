import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  testGrafana,
  testZabbix,
  testIxpManager,
  testZoho,
} from '../controllers/settings.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// All settings routes are admin-protected
router.get('/', authMiddleware, getSettings);
router.put('/', authMiddleware, updateSettings);
router.post('/test/grafana', authMiddleware, testGrafana);
router.post('/test/zabbix', authMiddleware, testZabbix);
router.post('/test/ixpmanager', authMiddleware, testIxpManager);
router.post('/test/zoho', authMiddleware, testZoho);

export default router;
